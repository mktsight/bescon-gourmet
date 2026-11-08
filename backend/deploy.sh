#!/bin/bash
set -e
REGION=ap-northeast-1
ACCOUNT=897729110502
FUNCTION=bescon-api
ROLE=bescon-lambda-role
API_NAME=bescon-api-gateway

echo "=== Step 0: DynamoDB ==="
# 新規環境用。既存テーブルがあれば作らない（describe-table で確認する冪等な作り方）
ensure_table() {
  local name=$1
  shift
  if aws dynamodb describe-table --table-name "$name" --region $REGION > /dev/null 2>&1; then
    echo "Table exists: $name"
  else
    aws dynamodb create-table --table-name "$name" --region $REGION \
      --billing-mode PAY_PER_REQUEST "$@" > /dev/null
    echo "Table created: $name"
  fi
  aws dynamodb wait table-exists --table-name "$name" --region $REGION
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

# 本番のキーは targetId/userId（バックエンドコードとの不一致は既知の未対応事項）
ensure_table bescon-participants \
  --attribute-definitions AttributeName=targetId,AttributeType=S AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=targetId,KeyType=HASH AttributeName=userId,KeyType=RANGE

# --- チーム機能の新規3テーブル ---
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

# 試行回数テーブルの掃除用 TTL（有効化済みなら何もしない）
TTL_STATUS=$(aws dynamodb describe-time-to-live --table-name bescon-team-attempts --region $REGION \
  --query 'TimeToLiveDescription.TimeToLiveStatus' --output text)
if [ "$TTL_STATUS" != "ENABLED" ] && [ "$TTL_STATUS" != "ENABLING" ]; then
  aws dynamodb update-time-to-live --table-name bescon-team-attempts --region $REGION \
    --time-to-live-specification Enabled=true,AttributeName=expiresAt > /dev/null
  echo "TTL enabled: bescon-team-attempts.expiresAt"
fi

# 既存の bescon-posts にチーム用 GSI が無い場合だけ追加し、ACTIVE を待つ
POSTS_TEAM_GSI=$(aws dynamodb describe-table --table-name bescon-posts --region $REGION \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='teamId-createdAt-index'].IndexStatus | [0]" --output text)
if [ "$POSTS_TEAM_GSI" = "None" ]; then
  aws dynamodb update-table --table-name bescon-posts --region $REGION \
    --attribute-definitions AttributeName=teamId,AttributeType=S AttributeName=createdAt,AttributeType=S \
    --global-secondary-index-updates '[{"Create":{"IndexName":"teamId-createdAt-index","KeySchema":[{"AttributeName":"teamId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}}]' > /dev/null
fi
until [ "$(aws dynamodb describe-table --table-name bescon-posts --region $REGION \
  --query "Table.GlobalSecondaryIndexes[?IndexName=='teamId-createdAt-index'].IndexStatus | [0]" --output text)" = "ACTIVE" ]; do
  echo "Waiting for bescon-posts teamId-createdAt-index..."
  sleep 5
done

echo "=== Step 1: IAM Role ==="
cat > /tmp/lambda-trust.json << 'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF

ROLE_ARN=$(aws iam create-role --role-name $ROLE \
  --assume-role-policy-document file:///tmp/lambda-trust.json \
  --query 'Role.Arn' --output text 2>/dev/null || \
  aws iam get-role --role-name $ROLE --query 'Role.Arn' --output text)
echo "Role: $ROLE_ARN"

aws iam attach-role-policy --role-name $ROLE \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

# Resource の table/bescon-* は、チーム機能の新テーブル(bescon-teams / bescon-team-members / bescon-team-attempts)と
# 各テーブルの GSI(table/bescon-*/index/*)も含むため、このブロックは変更しない。
# BatchGetItem と TransactWriteItems は許可しない（バックエンドは使わない）。テーブル名は必ず bescon- で始めること。
cat > /tmp/dynamo-policy.json << EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:DeleteItem","dynamodb:Query","dynamodb:Scan"],"Resource":"arn:aws:dynamodb:$REGION:$ACCOUNT:table/bescon-*"}]}
EOF
aws iam put-role-policy --role-name $ROLE --policy-name bescon-dynamo-policy \
  --policy-document file:///tmp/dynamo-policy.json
# 署名付きPUT URLの署名者(Lambdaロール)にPutObject権限が無いと、写真・アイコンのPUTが403になる
cat > /tmp/s3-upload-policy.json << EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject"],"Resource":["arn:aws:s3:::bescon-gourmet-uploads-$ACCOUNT/posts/*","arn:aws:s3:::bescon-gourmet-uploads-$ACCOUNT/profiles/*"]}]}
EOF
aws iam put-role-policy --role-name $ROLE --policy-name bescon-s3-upload-policy \
  --policy-document file:///tmp/s3-upload-policy.json

sleep 12

echo "=== Step 2: Package Lambda ==="
cd /Users/makotosaito/bescon/backend/src
npm install --production --silent
zip -r /tmp/bescon-api.zip . -x "*.md"

echo "=== Step 3: Deploy Lambda ==="
aws lambda create-function \
  --function-name $FUNCTION \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb:///tmp/bescon-api.zip \
  --timeout 30 --memory-size 256 \
  --region $REGION 2>/dev/null || \
aws lambda update-function-code \
  --function-name $FUNCTION \
  --zip-file fileb:///tmp/bescon-api.zip \
  --region $REGION

echo "=== Step 4: API Gateway ==="
API_ID=$(aws apigatewayv2 create-api \
  --name $API_NAME \
  --protocol-type HTTP \
  --cors-configuration AllowMethods="*",AllowHeaders="Authorization,Content-Type",AllowOrigins="*",MaxAge=86400 \
  --region $REGION \
  --query 'ApiId' --output text 2>/dev/null || \
  aws apigatewayv2 get-apis --region $REGION \
    --query "Items[?Name=='$API_NAME'].ApiId | [0]" --output text)
echo "API ID: $API_ID"

AUTHORIZER_ID=$(aws apigatewayv2 create-authorizer \
  --api-id $API_ID --authorizer-type JWT \
  --identity-source '$request.header.Authorization' \
  --name cognito-jwt \
  --jwt-configuration "Audience=4dibihst1apsh8jk7m4a33bs9g,Issuer=https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_9p93csVDt" \
  --region $REGION --query 'AuthorizerId' --output text)

LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT:function:$FUNCTION"
INT_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID --integration-type AWS_PROXY \
  --integration-uri $LAMBDA_ARN \
  --payload-format-version 2.0 \
  --region $REGION --query 'IntegrationId' --output text)

for ROUTE in "GET /posts" "POST /posts" "POST /posts/{id}/likes" "DELETE /posts/{id}/likes" \
             "POST /posts/{id}/comments" "GET /posts/{id}/comments" \
             "POST /posts/{id}/join" "DELETE /posts/{id}/join" "GET /posts/{id}/participants" \
             "GET /goals" "POST /goals" "PUT /goals/{goalId}" "DELETE /goals/{goalId}" \
             "GET /me" "PUT /me" "GET /members" "GET /members/{userId}" \
             "GET /events" "POST /events" "GET /events/{eventId}" \
             "POST /events/{eventId}/participants" "DELETE /events/{eventId}/participants" \
             "GET /notifications" "PUT /notifications/read-all" \
             "GET /places/search" "POST /ai/suggest" "GET /uploads/presigned-url" \
             "GET /teams" "POST /teams" "POST /teams/{teamId}/join" \
             "GET /teams/{teamId}/members" "DELETE /teams/{teamId}/members/me" \
             "PUT /teams/{teamId}/passphrase" "GET /me/teams" "PUT /me/last-team"; do
  aws apigatewayv2 create-route --api-id $API_ID \
    --route-key "$ROUTE" --authorization-type JWT \
    --authorizer-id $AUTHORIZER_ID \
    --target "integrations/$INT_ID" \
    --region $REGION > /dev/null
  echo "Route: $ROUTE"
done

aws apigatewayv2 create-stage --api-id $API_ID \
  --stage-name '$default' --auto-deploy --region $REGION 2>/dev/null || true

aws lambda add-permission \
  --function-name $FUNCTION \
  --statement-id "apigw-$API_ID" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API_ID/*/*" \
  --region $REGION 2>/dev/null || true

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
echo ""
echo "========================="
echo "API_URL=$API_URL"
echo "========================="
echo ""
echo "VITE_API_URL=$API_URL" > /Users/makotosaito/bescon/app/.env.local
echo "Written to /Users/makotosaito/bescon/app/.env.local"
