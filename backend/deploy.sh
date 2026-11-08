#!/usr/bin/env bash
# ベスコングルメ部 バックエンド構築・更新スクリプト（再実行しても重複リソースを作らない）
#
#   backend/deploy.sh [--yes|-y] [--dry-run|-n] [--help|-h]
#
# - 既にあるリソースは作らず、無いものだけを作る（テーブル / 索引 / ロール / Lambda / API / オーソライザー /
#   統合 / ルート / ステージ / Lambda 権限）。
# - 実行前に AWS のアカウントとリージョンを表示して確認する（--yes で省略。アカウントが違う場合は --yes でも中止）。
# - app/.env.local が既にあれば絶対に書き換えない。
# - S3 / Cognito / CloudFront は作らない（別途作成済みのものを使う）。
# macOS 標準の bash 3.2 でも動くように書いてある。
set -euo pipefail
export AWS_PAGER=""

# --- 定数 ---
REGION="${REGION:-ap-northeast-1}"
EXPECTED_ACCOUNT=897729110502
FUNCTION=bescon-api
ROLE=bescon-lambda-role
API_NAME=bescon-api-gateway
AUTHORIZER_NAME=cognito-jwt
COGNITO_AUDIENCE=4dibihst1apsh8jk7m4a33bs9g
COGNITO_ISSUER=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_9p93csVDt
UPLOAD_BUCKET="bescon-gourmet-uploads-$EXPECTED_ACCOUNT"
BASIC_EXEC_POLICY_ARN=arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
NOTFOUND_RE='ResourceNotFoundException|NoSuchEntity|NotFoundException|NotFound'

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SRC_DIR="$SCRIPT_DIR/src"
ENV_FILE="$SCRIPT_DIR/../app/.env.local"

# index.js の routeKey と同じ36本（ルートを足すときは index.js と必ずそろえる）
ROUTES=(
  "GET /posts" "POST /posts" "PUT /posts/{id}"
  "POST /posts/{id}/likes" "DELETE /posts/{id}/likes"
  "POST /posts/{id}/comments" "GET /posts/{id}/comments"
  "POST /posts/{id}/join" "DELETE /posts/{id}/join" "GET /posts/{id}/participants"
  "GET /goals" "POST /goals" "PUT /goals/{goalId}" "DELETE /goals/{goalId}"
  "GET /me" "PUT /me" "GET /members" "GET /members/{userId}"
  "GET /events" "POST /events" "GET /events/{eventId}"
  "POST /events/{eventId}/participants" "DELETE /events/{eventId}/participants"
  "GET /notifications" "PUT /notifications/read-all"
  "GET /places/search" "POST /ai/suggest" "GET /uploads/presigned-url"
  "GET /teams" "POST /teams" "POST /teams/{teamId}/join"
  "GET /teams/{teamId}/members" "DELETE /teams/{teamId}/members/me"
  "PUT /teams/{teamId}/passphrase" "GET /me/teams" "PUT /me/last-team"
)

# --- 引数 ---
ASSUME_YES=0
DRY_RUN=0

usage() {
  cat << 'EOF'
使い方: backend/deploy.sh [オプション]

  -y, --yes      確認プロンプトを省略する（アカウントの照合は省略しない）
  -n, --dry-run  何も変更せず、実行するはずのコマンドだけを表示する（読み取りは実際に行う）
  -h, --help     このメッセージを表示する

環境変数 REGION でリージョンを変更できる（既定: ap-northeast-1）。
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=1 ;;
    -n|--dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "不明なオプション: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# --- ヘルパー ---
info() { printf '%s\n' "$*"; }
warn() { printf '警告: %s\n' "$*" >&2; }
die() { printf 'エラー: %s\n' "$*" >&2; exit 1; }

# 読み取り専用。dry-run でも実行する
aws_r() { aws "$@" --region "$REGION"; }

# 変更を伴う呼び出し。dry-run ではコマンドを表示するだけ
aws_w() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '[dry-run] '
    printf '%q ' aws "$@" --region "$REGION"
    printf '\n'
    return 0
  fi
  aws "$@" --region "$REGION" > /dev/null
}

# 出力（ID など）を受け取る作成系。dry-run ではコマンドを stderr に表示し、代わりのプレースホルダーを返す
# 使い方: VAR=$(aws_w_out '<placeholder>' apigatewayv2 create-api ...)
aws_w_out() {
  local placeholder=$1
  shift
  if [ "$DRY_RUN" = 1 ]; then
    {
      printf '[dry-run] '
      printf '%q ' aws "$@" --region "$REGION"
      printf '\n'
    } >&2
    printf '%s\n' "$placeholder"
    return 0
  fi
  aws "$@" --region "$REGION"
}

# 読み取り結果を VAR に入れる。戻り値 0 = 取得できた / 1 = 存在しない。
# 「存在しない」と判断するのは stderr が正規表現に一致したときだけ。
# 権限エラーやスロットリングなどは中止する（作成には進まない）。出力の "None" は空文字として扱う。
# 使い方: if lookup VAR 'NotFoundRegex' -- aws_r ...; then ...; fi
lookup() {
  local __var=$1 __re=$2 __out __err __errf __rc=0
  shift 3
  __errf=$(mktemp)
  __out=$("$@" 2> "$__errf") || __rc=$?
  __err=$(cat "$__errf")
  rm -f "$__errf"
  if [ "$__rc" -ne 0 ]; then
    if printf '%s' "$__err" | grep -E "$__re" > /dev/null; then
      printf -v "$__var" '%s' ""
      return 1
    fi
    die "AWS の読み取りに失敗したため中止します（リソースは作成しません）: $__err"
  fi
  if [ "$__out" = "None" ]; then
    __out=""
  fi
  printf -v "$__var" '%s' "$__out"
  return 0
}

BUILD_DIR=""
cleanup() {
  if [ -n "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
  fi
}
trap cleanup EXIT

# =====================================================================
# 事前確認（ここまでは読み取りのみ）
# =====================================================================
info "=== 事前確認 ==="
[ -d "$SRC_DIR" ] || die "backend/src が見つかりません: $SRC_DIR"
[ -d "$(dirname "$ENV_FILE")" ] || die "app ディレクトリが見つかりません: $(dirname "$ENV_FILE")"

lookup ACCOUNT 'NEVER_MATCHES_ANYTHING' -- aws_r sts get-caller-identity --query Account --output text \
  || die "アカウントを取得できません"
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  die "接続中のアカウント ($ACCOUNT) が想定のアカウント ($EXPECTED_ACCOUNT) と違います。--yes でも続行しません"
fi

LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION"
ROLE_ARN="arn:aws:iam::$ACCOUNT:role/$ROLE"

info "アカウント      : $ACCOUNT"
info "リージョン      : $REGION"
info "Lambda 関数     : $FUNCTION"
info "API 名          : $API_NAME"
if [ "$DRY_RUN" = 1 ]; then
  info "モード          : dry-run（何も変更しない）"
fi
if ! aws_r s3api head-bucket --bucket "$UPLOAD_BUCKET" > /dev/null 2>&1; then
  warn "アップロード用バケット ($UPLOAD_BUCKET) を確認できません。このスクリプトはバケットを作りません"
fi

if [ "$DRY_RUN" = 0 ] && [ "$ASSUME_YES" = 0 ]; then
  if [ ! -t 0 ]; then
    die "対話端末がないため確認できません。内容を確認のうえ --yes を付けて実行してください（何も変更していません）"
  fi
  printf 'このアカウント・リージョンに作成・更新します。続けますか？ [y/N] '
  read -r ANSWER || ANSWER=""
  case "$ANSWER" in
    y|Y|yes|YES|Yes) ;;
    *) die "中止しました（何も変更していません）" ;;
  esac
fi

# =====================================================================
# Step 0: DynamoDB
# =====================================================================
info "=== Step 0: DynamoDB ==="
# dry-run で「作るはずのテーブル」を覚えておく（後続の索引・TTL の確認を飛ばすため）
PLANNED_TABLES=" "

# テーブルが無いときだけ作る。無い判定は ResourceNotFoundException のときだけ
ensure_table() {
  local name=$1 status
  shift
  if lookup status 'ResourceNotFoundException' -- \
    aws_r dynamodb describe-table --table-name "$name" --query Table.TableStatus --output text; then
    info "テーブルあり: $name"
    if [ "$status" != "ACTIVE" ]; then
      aws_w dynamodb wait table-exists --table-name "$name"
    fi
  else
    aws_w dynamodb create-table --table-name "$name" --billing-mode PAY_PER_REQUEST "$@"
    aws_w dynamodb wait table-exists --table-name "$name"
    PLANNED_TABLES="$PLANNED_TABLES$name "
    info "テーブル作成: $name"
  fi
}

# 索引が無いときだけ追加し、ACTIVE になるまで待つ（最大 60 回 x 5 秒）
# $3 は属性定義（空白区切りで複数）、$4 は --global-secondary-index-updates 用の JSON
ensure_gsi() {
  local table=$1 index=$2 attrs=$3 create_json=$4 status i
  case "$PLANNED_TABLES" in
    *" $table "*) return 0 ;; # このあと（または今）テーブルと一緒に作られる
  esac
  lookup status 'ResourceNotFoundException' -- \
    aws_r dynamodb describe-table --table-name "$table" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='$index'].IndexStatus | [0]" --output text \
    || die "テーブルが見つかりません: $table"
  if [ -z "$status" ]; then
    # shellcheck disable=SC2086 # 属性定義は意図的に空白で分割する
    aws_w dynamodb update-table --table-name "$table" --attribute-definitions $attrs \
      --global-secondary-index-updates "$create_json"
    info "索引追加: $table / $index"
    status="CREATING"
  else
    info "索引あり: $table / $index"
  fi
  if [ "$status" != "ACTIVE" ] && [ "$DRY_RUN" = 0 ]; then
    for i in $(seq 1 60); do
      lookup status 'ResourceNotFoundException' -- \
        aws_r dynamodb describe-table --table-name "$table" \
        --query "Table.GlobalSecondaryIndexes[?IndexName=='$index'].IndexStatus | [0]" --output text \
        || die "テーブルが見つかりません: $table"
      if [ "$status" = "ACTIVE" ]; then
        break
      fi
      info "索引の作成待ち: $table / $index ($i/60)"
      sleep 5
    done
    [ "$status" = "ACTIVE" ] || die "索引が ACTIVE になりません: $table / $index"
  fi
}

# --- 既存7テーブル（本番の実スキーマ。aws dynamodb describe-table で確認済み）---
ensure_table bescon-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH

ensure_table bescon-posts \
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=userId,AttributeType=S \
                          AttributeName=createdAt,AttributeType=S AttributeName=teamId,AttributeType=S \
  --key-schema AttributeName=postId,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"userId-createdAt-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"teamId-createdAt-index","KeySchema":[{"AttributeName":"teamId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table bescon-goals \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=goalId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=goalId,KeyType=RANGE

ensure_table bescon-reactions \
  --attribute-definitions AttributeName=postId,AttributeType=S AttributeName=reactionId,AttributeType=S \
  --key-schema AttributeName=postId,KeyType=HASH AttributeName=reactionId,KeyType=RANGE

ensure_table bescon-notifications \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=notificationId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=notificationId,KeyType=RANGE

ensure_table bescon-events \
  --attribute-definitions AttributeName=eventId,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH

# 本番のキーは targetId/userId。バックエンド（index.js）は eventId で読み書きしており食い違っている。
# これは既知の別件で、このスクリプトでは直さない（本番の実スキーマに合わせて作る）
ensure_table bescon-participants \
  --attribute-definitions AttributeName=targetId,AttributeType=S AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=targetId,KeyType=HASH AttributeName=userId,KeyType=RANGE

# --- チーム機能の3テーブル ---
ensure_table bescon-teams \
  --attribute-definitions AttributeName=teamId,AttributeType=S \
  --key-schema AttributeName=teamId,KeyType=HASH

ensure_table bescon-team-members \
  --attribute-definitions AttributeName=teamId,AttributeType=S AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=teamId,KeyType=HASH AttributeName=userId,KeyType=RANGE \
  --global-secondary-indexes '[{"IndexName":"userId-teamId-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"teamId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'

ensure_table bescon-team-attempts \
  --attribute-definitions AttributeName=attemptKey,AttributeType=S \
  --key-schema AttributeName=attemptKey,KeyType=HASH

# --- 索引（テーブルが既にあって索引だけ無い場合に追加する）---
ensure_gsi bescon-posts userId-createdAt-index \
  "AttributeName=userId,AttributeType=S AttributeName=createdAt,AttributeType=S" \
  '[{"Create":{"IndexName":"userId-createdAt-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]'

ensure_gsi bescon-posts teamId-createdAt-index \
  "AttributeName=teamId,AttributeType=S AttributeName=createdAt,AttributeType=S" \
  '[{"Create":{"IndexName":"teamId-createdAt-index","KeySchema":[{"AttributeName":"teamId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]'

ensure_gsi bescon-team-members userId-teamId-index \
  "AttributeName=userId,AttributeType=S AttributeName=teamId,AttributeType=S" \
  '[{"Create":{"IndexName":"userId-teamId-index","KeySchema":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"teamId","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]'

# --- 試行回数テーブルの掃除用 TTL（無効のときだけ有効にする）---
case "$PLANNED_TABLES" in
  *" bescon-team-attempts "*)
    aws_w dynamodb update-time-to-live --table-name bescon-team-attempts \
      --time-to-live-specification Enabled=true,AttributeName=expiresAt
    info "TTL 有効化: bescon-team-attempts.expiresAt"
    ;;
  *)
    lookup TTL_STATUS 'ResourceNotFoundException' -- \
      aws_r dynamodb describe-time-to-live --table-name bescon-team-attempts \
      --query TimeToLiveDescription.TimeToLiveStatus --output text \
      || die "テーブルが見つかりません: bescon-team-attempts"
    if [ "$TTL_STATUS" = "DISABLED" ]; then
      aws_w dynamodb update-time-to-live --table-name bescon-team-attempts \
        --time-to-live-specification Enabled=true,AttributeName=expiresAt
      info "TTL 有効化: bescon-team-attempts.expiresAt"
    else
      info "TTL あり: bescon-team-attempts ($TTL_STATUS)"
    fi
    ;;
esac

# =====================================================================
# Step 1: IAM ロール
# =====================================================================
info "=== Step 1: IAM Role ==="
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
ROLE_CREATED=0

if lookup EXISTING_ROLE_ARN 'NoSuchEntity' -- aws_r iam get-role --role-name "$ROLE" --query Role.Arn --output text; then
  ROLE_ARN=$EXISTING_ROLE_ARN
  info "ロールあり: $ROLE"
else
  aws_w iam create-role --role-name "$ROLE" --assume-role-policy-document "$TRUST_POLICY"
  ROLE_CREATED=1
  info "ロール作成: $ROLE"
fi

ATTACHED=""
if [ "$ROLE_CREATED" = 0 ]; then
  lookup ATTACHED 'NoSuchEntity' -- \
    aws_r iam list-attached-role-policies --role-name "$ROLE" --query 'AttachedPolicies[].PolicyArn' --output text \
    || ATTACHED=""
fi
case "$ATTACHED" in
  *"$BASIC_EXEC_POLICY_ARN"*) info "AWSLambdaBasicExecutionRole: アタッチ済み" ;;
  *)
    aws_w iam attach-role-policy --role-name "$ROLE" --policy-arn "$BASIC_EXEC_POLICY_ARN"
    info "AWSLambdaBasicExecutionRole: アタッチ"
    ;;
esac

# Resource の table/bescon-* は、チーム機能の新テーブル(bescon-teams / bescon-team-members / bescon-team-attempts)と
# 各テーブルの GSI(table/bescon-*/index/*)も含むため、このブロックは変更しない。
# BatchGetItem と TransactWriteItems は許可しない（バックエンドは使わない）。テーブル名は必ず bescon- で始めること。
DYNAMO_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan"],"Resource":"arn:aws:dynamodb:'"$REGION:$ACCOUNT"':table/bescon-*"}]}'
# put-role-policy は同じ内容を何度入れても結果が変わらないため、毎回実行する
aws_w iam put-role-policy --role-name "$ROLE" --policy-name bescon-dynamo-policy \
  --policy-document "$DYNAMO_POLICY"
# 署名付きPUT URLの署名者(Lambdaロール)にPutObject権限が無いと、写真・アイコンのPUTが403になる
S3_UPLOAD_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject"],"Resource":["arn:aws:s3:::'"$UPLOAD_BUCKET"'/posts/*","arn:aws:s3:::'"$UPLOAD_BUCKET"'/profiles/*"]}]}'
aws_w iam put-role-policy --role-name "$ROLE" --policy-name bescon-s3-upload-policy \
  --policy-document "$S3_UPLOAD_POLICY"
info "ロールポリシー: bescon-dynamo-policy / bescon-s3-upload-policy を設定"

if [ "$ROLE_CREATED" = 1 ] && [ "$DRY_RUN" = 0 ]; then
  info "ロールが使えるようになるまで待機します"
  sleep 12
fi

# =====================================================================
# Step 2: Lambda のパッケージ作成
# =====================================================================
info "=== Step 2: Package Lambda ==="
if [ "$DRY_RUN" = 1 ]; then
  ZIP="<build-dir>/bescon-api.zip"
  info "[dry-run] (cd $SRC_DIR && npm install --omit=dev --silent && zip -qr $ZIP . -x \"*.md\")"
else
  BUILD_DIR=$(mktemp -d)
  ZIP="$BUILD_DIR/bescon-api.zip"
  (cd "$SRC_DIR" && npm install --omit=dev --silent && zip -qr "$ZIP" . -x "*.md")
  info "zip 作成: $ZIP"
fi

# =====================================================================
# Step 3: Lambda
# =====================================================================
info "=== Step 3: Deploy Lambda ==="

# 作成直後のロールをまだ引き受けられないとき (InvalidParameterValueException) だけ、最大5回リトライする
create_function() {
  local args i err
  args=(lambda create-function --function-name "$FUNCTION" --runtime nodejs20.x --role "$ROLE_ARN"
    --handler index.handler --zip-file "fileb://$ZIP" --timeout 30 --memory-size 256)
  if [ "$DRY_RUN" = 1 ]; then
    aws_w "${args[@]}"
    return 0
  fi
  for i in 1 2 3 4 5; do
    if err=$(aws "${args[@]}" --region "$REGION" 2>&1 > /dev/null); then
      return 0
    fi
    case "$err" in
      *InvalidParameterValueException*)
        if [ "$i" -lt 5 ]; then
          warn "ロールがまだ使えません。6 秒後に再試行します ($i/5)"
          sleep 6
          continue
        fi
        ;;
    esac
    die "Lambda 関数の作成に失敗しました: $err"
  done
}

if lookup FN_CONFIG "$NOTFOUND_RE" -- \
  aws_r lambda get-function --function-name "$FUNCTION" \
  --query 'Configuration.[Runtime,Handler,Timeout,MemorySize,Role]' --output text; then
  # コードは毎回更新する（このスクリプトの目的）。設定は差があるときだけ更新する
  aws_w lambda update-function-code --function-name "$FUNCTION" --zip-file "fileb://$ZIP"
  aws_w lambda wait function-updated --function-name "$FUNCTION"
  read -r CUR_RUNTIME CUR_HANDLER CUR_TIMEOUT CUR_MEMORY CUR_ROLE <<< "$FN_CONFIG"
  if [ "$CUR_RUNTIME" != "nodejs20.x" ] || [ "$CUR_HANDLER" != "index.handler" ] \
    || [ "$CUR_TIMEOUT" != "30" ] || [ "$CUR_MEMORY" != "256" ] || [ "$CUR_ROLE" != "$ROLE_ARN" ]; then
    aws_w lambda update-function-configuration --function-name "$FUNCTION" \
      --runtime nodejs20.x --handler index.handler --timeout 30 --memory-size 256 --role "$ROLE_ARN"
    aws_w lambda wait function-updated --function-name "$FUNCTION"
    info "Lambda 設定を更新: $FUNCTION"
  else
    info "Lambda 設定は変更なし: $FUNCTION"
  fi
  info "Lambda コードを更新: $FUNCTION"
else
  create_function
  aws_w lambda wait function-updated --function-name "$FUNCTION"
  info "Lambda 作成: $FUNCTION"
fi

# =====================================================================
# Step 4: API Gateway
# =====================================================================
info "=== Step 4: API Gateway ==="
API_NEW=0

lookup API_IDS 'NEVER_MATCHES_ANYTHING' -- \
  aws_r apigatewayv2 get-apis --query "Items[?Name=='$API_NAME'].ApiId" --output text
# shellcheck disable=SC2086 # ID を空白で数える
set -- $API_IDS
API_COUNT=$#
if [ "$API_COUNT" -gt 1 ]; then
  die "同じ名前 ($API_NAME) の API が $API_COUNT 個あります。どれを使うか判断できないため中止します（何も作成していません）"
elif [ "$API_COUNT" -eq 1 ]; then
  API_ID=$1
  info "API あり: $API_NAME"
else
  API_ID=$(aws_w_out '<new-api-id>' apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration '{"AllowMethods":["*"],"AllowHeaders":["Authorization","Content-Type"],"AllowOrigins":["*"],"MaxAge":86400}' \
    --query ApiId --output text)
  API_NEW=1
  info "API 作成: $API_NAME"
fi

ROUTE_TABLE=""
AUTHORIZER_ID="<new-authorizer-id>"
INT_ID="<new-integration-id>"

if [ "$API_NEW" = 0 ]; then
  # 既存ルート（RouteKey / 認可方式 / オーソライザー / ターゲット をタブ区切りで全件）
  lookup ROUTE_TABLE 'NEVER_MATCHES_ANYTHING' -- \
    aws_r apigatewayv2 get-routes --api-id "$API_ID" \
    --query 'Items[].[RouteKey,AuthorizationType,AuthorizerId,Target]' --output text

  # 複数ある場合は、既存ルートが使っているものを優先する（無ければ先頭）
  pick_preferred() { # $1: 候補 ID（空白区切り） $2: ルート表の列番号 $3: 値の接頭辞
    local candidates=$1 col=$2 prefix=$3 id
    for id in $candidates; do
      if printf '%s\n' "$ROUTE_TABLE" | cut -f"$col" | grep -Fx -- "$prefix$id" > /dev/null; then
        printf '%s' "$id"
        return 0
      fi
    done
    # shellcheck disable=SC2086
    set -- $candidates
    printf '%s' "$1"
  }

  lookup AUTH_IDS 'NEVER_MATCHES_ANYTHING' -- \
    aws_r apigatewayv2 get-authorizers --api-id "$API_ID" \
    --query "Items[?Name=='$AUTHORIZER_NAME'].AuthorizerId" --output text
  # shellcheck disable=SC2086
  set -- $AUTH_IDS
  if [ "$#" -ge 1 ]; then
    if [ "$#" -gt 1 ]; then
      warn "オーソライザー $AUTHORIZER_NAME が $# 個あります。既存ルートが使っているものを優先します（削除はしません）"
    fi
    AUTHORIZER_ID=$(pick_preferred "$AUTH_IDS" 3 "")
    info "オーソライザーあり: $AUTHORIZER_NAME"
  else
    AUTHORIZER_ID=""
  fi

  lookup INT_IDS 'NEVER_MATCHES_ANYTHING' -- \
    aws_r apigatewayv2 get-integrations --api-id "$API_ID" \
    --query "Items[?IntegrationType=='AWS_PROXY' && IntegrationUri=='$LAMBDA_ARN'].IntegrationId" --output text
  # shellcheck disable=SC2086
  set -- $INT_IDS
  if [ "$#" -ge 1 ]; then
    if [ "$#" -gt 1 ]; then
      warn "同じ Lambda への統合が $# 個あります。既存ルートが使っているものを優先します（削除はしません）"
    fi
    INT_ID=$(pick_preferred "$INT_IDS" 4 "integrations/")
    info "統合あり: $FUNCTION"
  else
    INT_ID=""
  fi
fi

if [ "$API_NEW" = 1 ] || [ -z "$AUTHORIZER_ID" ]; then
  AUTHORIZER_ID=$(aws_w_out '<new-authorizer-id>' apigatewayv2 create-authorizer \
    --api-id "$API_ID" --authorizer-type JWT \
    --identity-source '$request.header.Authorization' \
    --name "$AUTHORIZER_NAME" \
    --jwt-configuration "Audience=$COGNITO_AUDIENCE,Issuer=$COGNITO_ISSUER" \
    --query AuthorizerId --output text)
  info "オーソライザー作成: $AUTHORIZER_NAME"
fi

if [ "$API_NEW" = 1 ] || [ -z "$INT_ID" ]; then
  INT_ID=$(aws_w_out '<new-integration-id>' apigatewayv2 create-integration \
    --api-id "$API_ID" --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version 2.0 \
    --query IntegrationId --output text)
  info "統合作成: $FUNCTION"
fi

# ルート：RouteKey が無いものだけ作る。既存ルートは変更しない
EXISTING_KEYS=$(printf '%s\n' "$ROUTE_TABLE" | cut -f1)
CREATED_ROUTES=0
for ROUTE in "${ROUTES[@]}"; do
  if printf '%s\n' "$EXISTING_KEYS" | grep -Fx -- "$ROUTE" > /dev/null; then
    ROUTE_AUTH=$(printf '%s\n' "$ROUTE_TABLE" | awk -F'\t' -v k="$ROUTE" '$1 == k { print $2; exit }')
    if [ "$ROUTE_AUTH" != "JWT" ]; then
      warn "既存ルート '$ROUTE' の認可方式が JWT ではありません ($ROUTE_AUTH)。変更はしません"
    fi
    continue
  fi
  aws_w apigatewayv2 create-route --api-id "$API_ID" \
    --route-key "$ROUTE" --authorization-type JWT \
    --authorizer-id "$AUTHORIZER_ID" \
    --target "integrations/$INT_ID"
  info "ルート作成: $ROUTE"
  CREATED_ROUTES=$((CREATED_ROUTES + 1))
done
info "ルート: 全 ${#ROUTES[@]} 本のうち $CREATED_ROUTES 本を作成"

# ROUTES に無い既存ルートは触らず、知らせるだけにする
while IFS= read -r KEY; do
  [ -n "$KEY" ] || continue
  FOUND=0
  for ROUTE in "${ROUTES[@]}"; do
    if [ "$ROUTE" = "$KEY" ]; then
      FOUND=1
      break
    fi
  done
  if [ "$FOUND" = 0 ]; then
    warn "deploy.sh の一覧に無い既存ルートがあります: $KEY（変更しません）"
  fi
done <<< "$EXISTING_KEYS"

# ステージ（$default）
STAGE_EXISTS=0
if [ "$API_NEW" = 0 ]; then
  if lookup STAGE_NAME "$NOTFOUND_RE" -- \
    aws_r apigatewayv2 get-stage --api-id "$API_ID" --stage-name '$default' --query StageName --output text; then
    STAGE_EXISTS=1
  fi
fi
if [ "$STAGE_EXISTS" = 1 ]; then
  info "ステージあり: \$default"
else
  aws_w apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy
  info "ステージ作成: \$default"
fi

# API Gateway から Lambda を呼ぶ許可（この API 用の許可が無いときだけ追加）
LAMBDA_POLICY=""
if [ "$API_NEW" = 0 ]; then
  lookup LAMBDA_POLICY "$NOTFOUND_RE" -- \
    aws_r lambda get-policy --function-name "$FUNCTION" --query Policy --output text \
    || LAMBDA_POLICY=""
fi
case "$LAMBDA_POLICY" in
  *":$API_ID/"*) info "Lambda の呼び出し許可あり" ;;
  *)
    aws_w lambda add-permission \
      --function-name "$FUNCTION" \
      --statement-id "apigw-$API_ID" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*/*"
    info "Lambda の呼び出し許可を追加"
    ;;
esac

# =====================================================================
# Step 5: app/.env.local
# =====================================================================
API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
EXPECTED_LINE="VITE_API_URL=$API_URL"

info ""
info "========================="
info "API_URL=$API_URL"
info "========================="
info ""

if [ -e "$ENV_FILE" ] || [ -L "$ENV_FILE" ]; then
  info "app/.env.local は既に存在するため変更しません"
  info "期待する行: $EXPECTED_LINE"
  if [ "$DRY_RUN" = 1 ] && [ "$API_NEW" = 1 ]; then
    info "既存ファイルとの比較: dry-run で API が未作成のため行いません"
  elif grep -Fxq -- "$EXPECTED_LINE" "$ENV_FILE"; then
    info "既存ファイルにこの行が含まれているか: 一致"
  else
    info "既存ファイルにこの行が含まれているか: 不一致（必要なら手動で直してください）"
  fi
elif [ "$DRY_RUN" = 1 ]; then
  info "[dry-run] app/.env.local を作成します（権限 600）: $EXPECTED_LINE"
else
  (umask 077 && printf '%s\n' "$EXPECTED_LINE" > "$ENV_FILE")
  chmod 600 "$ENV_FILE"
  info "app/.env.local を作成しました（権限 600）"
fi

if [ "$DRY_RUN" = 1 ]; then
  info "dry-run のため、AWS には何も変更していません"
fi
