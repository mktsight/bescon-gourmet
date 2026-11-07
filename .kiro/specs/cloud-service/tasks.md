# Implementation Plan: cloud-service

## Overview

ベスコングルメ部の運営サービス（v1: イベント案内と出欠回答）を、新規ディレクトリ `cloud-service/` に Node.js 20 で実装する。npm パッケージは追加せず、テストは `node:test` と自作のプロパティテスト補助関数（`test/helpers/pbt.js`）で行う。

進め方は次のとおり。

1. コードを追加する前に、既存フライヤー資産の SHA-256 を記録する。
2. AWS に依存しない純粋関数（日付、入力検証、役割判定、仮パスワード、一覧と集計）を作る。
3. 差し替え可能な DynamoDB／Cognito アダプタと、テスト用のメモリ実装を作る。
4. `createApp(deps)` に API の処理関数を順に追加する。
5. ブラウザ側の共有モジュール、描画関数、制御スクリプト、単一 HTML の組み立てを作る。
6. 最後に `src/handler.js` で SDK と依存を結線し、`template.json`、`scripts/create-bucho.sh`、`README.md` を作る。

既存フライヤー資産（`.agents/flyer/`、`.kiro/skills/bescon-flyer/`、ワークスペース直下の `BCG企画_*.svg/png`）と `.agents/tasks/task-bescon-flyer-skill/originals.sha256` は、どのタスクでも読み取り以外の操作をしない。`originals.sha256` は読み取りもしない。

## Tasks

- [ ] 1. 既存資産のハッシュ記録とプロジェクトの土台
  - [ ] 1.1 既存フライヤー資産の SHA-256 マニフェストを記録する
    - 他のどのファイルよりも先に `cloud-service/test/fixtures/flyer-assets.sha256` を作成する
    - 対象: `.agents/flyer/` 配下の全ファイル、`.kiro/skills/bescon-flyer/` 配下の全ファイル（再帰）、ワークスペース直下の `BCG企画_*.svg` と `BCG企画_*.png`
    - `.DS_Store` は対象外とする（Finder が書き換えるため）
    - 1行の形式は `<SHA-256 の16進64文字><空白2つ><ワークスペースからの相対パス>`。パスは NFC に正規化し、区切りは `/`、行はパスの昇順、改行は LF
    - `node -e` と `node:crypto` で一度だけ計算して書き出す。既存ファイルには書き込まない。`.agents/tasks/task-bescon-flyer-skill/originals.sha256` は読まない
    - 収集規則（対象、除外、正規化、並び順）は 14.6 の分離テストで同じものを再実装するため、マニフェストの先頭に `#` で始まるコメント行として記載する
    - _Requirements: 11.2_

  - [ ] 1.2 `cloud-service/package.json` とディレクトリの骨組みを作る
    - `name`、`private: true`、`engines.node: ">=20"`、`scripts.test: "node --test"` を書き、`dependencies` と `devDependencies` は書かない
    - モジュール形式は CommonJS（`src/shared/*.js` の UMD と `require` を使うため）
    - `src/`、`src/repo/`、`src/directory/`、`src/shared/`、`src/web/`、`scripts/`、`test/helpers/`、`test/fixtures/` を設計のディレクトリ構成どおりに用意する
    - _Requirements: 10.2, 11.1, 11.3_

  - [ ] 1.3 プロパティテスト補助 `test/helpers/pbt.js` を実装する
    - `createRng(seed)`（mulberry32）、`forAll(gen, prop, { runs = 100, seed })`（`prop` は async 可、既定シードは `PBT_SEED` 環境変数または `Date.now()`）
    - 失敗時のエラーメッセージに seed、試行番号、反例の JSON を含める。縮小（shrinking）は実装しない
    - 生成器 `gen`: `int`、`pick`、`array`、`subset`、`string`、`jaString`、`dateParts`、`isoDate`、`hhmm`、`uuid`、`oneOf`、`constant`
    - 文字列生成器は ASCII、ひらがな・漢字、全角空白、絵文字（サロゲートペア）、`& < > " '` を混ぜ、空文字や境界値を高い確率で出す
    - Node.js 20 の `node --test` は `test/` 配下の `.js` をすべてテストファイルとして読み込むため、`test/helpers/` のファイルは読み込み時に副作用を持たないようにする
    - _Requirements: 11.3_

  - [ ] 1.4 ドメイン用の生成器 `test/helpers/generators.js` を実装する
    - 有効なイベント入力（前後の空白、日本語、絵文字、HTML 特殊文字を含む）、無効なイベント入力、メンバー集合（部長と部員の混在）、claims（部長／部員、`cognito:groups` の各表現形式）、出欠回答の集合、回答操作の列、現在時刻（JST の日付境界である UTC 15:00 前後を含む）
    - `pbt.js` の `gen` だけを使い、`src/` には依存しない
    - _Requirements: 11.3_

  - [ ]* 1.5 `pbt.js` の単体テストを書く
    - 同じシードで同じ系列になること、`forAll` が失敗時に seed と反例を含むエラーを投げること、`runs` 回試行すること
    - _Requirements: 11.3_

- [ ] 2. 日付とラベルの共有モジュール
  - [ ] 2.1 `src/shared/dates.js` を UMD 形式で実装する
    - `todayJst(now)`（UTC に9時間を足した日付）、`isUpcoming(date, now)`（文字列比較）、`isValidDate(s)`（グレゴリオ暦の閏年規則）、`isValidTime(s)`（`^([01]\d|2[0-3]):[0-5]\d$`）、`formatDateJa(date)`（`2026年11月14日（土）`、月日の先頭ゼロなし、全角括弧、曜日は `Date.UTC` で求める）
    - _Requirements: 4.3, 4.4, 7.1, 7.2, 7.5_

  - [ ]* 2.2 Property 17 のプロパティテストを書く（`test/dates.property.test.js`）
    - **Property 17: 開催日の表示形式と曜日**
    - **Validates: Requirements 7.5**

  - [ ] 2.3 `src/shared/labels.js` を UMD 形式で実装する
    - 6項目の項目名、回答ラベル（参加／不参加／未回答）、設計の Error Handling 表にある画面向けメッセージ、入力検証メッセージを生成する関数（`required`、開催日・集合時刻の `format`、項目名と上限と現在の文字数を含む `maxLength`）
    - _Requirements: 1.2, 4.2, 4.3, 4.4, 4.5, 7.3, 7.6, 7.7, 8.5_

- [ ] 3. 入力検証
  - [ ] 3.1 `src/validation.js` を実装する
    - `EVENT_FIELDS`、`validateEventInput`、`validateRsvpInput`、`validateMemberInput`
    - 前後の空白（全角空白を含む `\s`）を除いてから判定する。欠落、`null`、文字列以外、除去後に空文字は `required`
    - 文字数はコードポイント数で数える。エラーは1項目につき最大1件で `required` を優先し、全項目のエラーを `EVENT_FIELDS` の順に返す。6項目以外のキーは無視し、除去後の値を返す
    - 回答は `status` が `'attend'` か `'absent'` のときだけ成功する
    - メンバーはメールアドレスを小文字化し、254文字以内で形式を満たすこと、表示名は1〜30文字
    - 日付と時刻の判定は `shared/dates.js`、メッセージは `shared/labels.js` を使う
    - _Requirements: 3.1, 4.2, 4.3, 4.4, 4.5, 5.2, 8.6_

  - [ ]* 3.2 Property 6 のプロパティテストを書く（`test/validation.property.test.js`）
    - **Property 6: 空欄の項目を正確に指摘する**
    - **Validates: Requirements 4.2**

  - [ ]* 3.3 Property 7 のプロパティテストを書く（`test/validation.property.test.js`）
    - **Property 7: 開催日と集合時刻の形式判定がオラクルと一致する**
    - テスト内のオラクルは `isValidDate`／`isValidTime` の実装とは独立に書く
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 3.4 Property 8 のプロパティテストを書く（`test/validation.property.test.js`）
    - **Property 8: 文字数上限の境界**
    - **Validates: Requirements 4.5**

- [ ] 4. 役割判定と仮パスワード
  - [ ] 4.1 `src/auth.js` を実装する
    - `identityFromEvent(event)`: ペイロード v2.0 の `requestContext.authorizer.jwt.claims` から `{ id: sub, name, email, role }` を作る。claims か `sub` が無ければ `null`
    - `parseGroups(value)`: 配列、`"[bucho other]"` 形式、カンマ区切り、欠落に対応
    - `roleFromClaims(claims)`: `bucho` を含むときだけ `'bucho'`、それ以外は `'buin'`
    - _Requirements: 2.1, 3.3, 8.7_

  - [ ]* 4.2 Property 3 のプロパティテストを書く（`test/auth.property.test.js`）
    - **Property 3: 役割は常にちょうど1つ**
    - **Validates: Requirements 3.3**

  - [ ] 4.3 `src/password.js` を実装する
    - `generateTemporaryPassword(randomInt = crypto.randomInt)`: 12文字、英小文字・英大文字・数字をそれぞれ1文字以上、`0 O o 1 l I` を使わない
    - _Requirements: 3.1_

  - [ ]* 4.4 Property 4 のプロパティテストを書く（`test/password.property.test.js`）
    - **Property 4: 仮パスワードはパスワードポリシーを満たす**
    - `randomInt` に `createRng` 由来の関数を注入して任意の乱数系列を作る
    - **Validates: Requirements 3.1**

- [ ] 5. 一覧の抽出と回答状況の集計
  - [ ] 5.1 `src/events.js` を実装する
    - `selectEvents(events, scope, now)`: upcoming は `date >= todayJst(now)` を (date, time, id) の昇順、past は `date < todayJst(now)` を (date, time) の降順で同値は id の昇順
    - `toListItem(event, rsvpOfMember)`: `{ id, title, date, dateLabel, time, myStatus }`。回答が無ければ `myStatus: 'none'`
    - `summarize(members, rsvps)`: 各メンバーを attend／absent／none のちょうど1つに分類し、メンバー一覧にいない memberId の回答は数えない。各一覧は表示名の昇順（`localeCompare('ja')`）。メールアドレスは含めない
    - _Requirements: 4.6, 7.1, 7.2, 7.3, 9.1, 9.2_

  - [ ]* 5.2 Property 14 のプロパティテストを書く（`test/events.property.test.js` と `test/dates.property.test.js`）
    - **Property 14: 一覧の分割と並び順**
    - `selectEvents` の分割・並び順・互いに素・和集合は `events.property.test.js`、`todayJst(now)` が `now` に9時間を足した UTC 日付と等しいことは `dates.property.test.js` に書く
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 5.3 Property 23 のプロパティテストを書く（`test/events.property.test.js`）
    - **Property 23: 回答状況は全メンバーをちょうど1回ずつ分類する**
    - **Validates: Requirements 9.1, 9.2**

- [ ] 6. Checkpoint - 純粋関数のテストがすべて通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. HTTP 基盤とルーター
  - [ ] 7.1 `src/http.js` を実装する
    - `HttpError(status, code, message, fields?)`、JSON レスポンス生成（`application/json; charset=utf-8`、`Cache-Control: no-store`）、エラー本文 `{ error: { code, message, fields? } }` の生成
    - JSON 本文の解析: 16 KB 超または JSON でない場合は 400 `BAD_REQUEST`。`isBase64Encoded` に対応する
    - _Requirements: 2.1, 4.2, 8.6_

  - [ ] 7.2 `src/router.js` を実装する
    - `route(method, path)` → `{ name, params } | null`。API 仕様の表にある9ルートを扱う
    - 一致しないパスは 404 `NOT_FOUND`、パスは一致するがメソッドが違う場合は 405 `METHOD_NOT_ALLOWED` を判別できる戻り値にする
    - イベント ID が `^[0-9a-f-]{36}$` に一致しない場合は 404 `EVENT_NOT_FOUND` として扱う
    - _Requirements: 7.6_

- [ ] 8. DynamoDB／Cognito アダプタとテスト用のメモリ実装
  - [ ] 8.1 `src/repo/dynamo.js` の `createDynamoRepo({ tableName, send })` を実装する
    - `listEventsFor`（Scan と `LastEvaluatedKey` の繰り返し）、`getEventWithRsvps`（Query）、`createEvent`（Put、`attribute_not_exists(pk)`）、`updateEvent`（Update、`attribute_exists(pk)`、`ALL_NEW`、回答項目は触らない）、`putRsvp`（TransactWrite の ConditionCheck + Put、失敗時に META を読み直して `not_found`／`changed` を返す）
    - `deleteEvent`: META を先に条件付き Delete し、残りの回答を Query して BatchWrite で25件ずつ削除、`UnprocessedItems` は最大3回再試行。META が無い場合も回答を掃除してから `false` を返す
    - キーは `pk = EVENT#<id>`、`sk = META` または `RSVP#<memberId>`。AWS SDK は `require` しない
    - _Requirements: 4.1, 4.6, 5.1, 5.3, 5.5, 8.1, 8.2, 8.3, 8.5_

  - [ ]* 8.2 `test/repo-dynamo.test.js` の単体テストを書く
    - 各メソッドが `send` に渡すコマンド名と入力、削除で META を先に消すこと、26件以上の回答で BatchWrite を分割すること、`UnprocessedItems` の再試行、`putRsvp` の条件失敗の分類
    - _Requirements: 5.3, 5.5, 8.2, 8.3_

  - [ ] 8.3 `src/directory/cognito.js` の `createCognitoDirectory({ userPoolId, send })` と `DirectoryError` を実装する
    - `listMembers`: ListUsers を `PaginationToken` がある間繰り返し、`Enabled=true` だけ返す。`FORCE_CHANGE_PASSWORD` のユーザーも含め、`name` が無ければ email を表示名にする
    - `createMember`: AdminCreateUser（`Username=email`、`email`、`email_verified=true`、`name`、`TemporaryPassword`、`MessageAction: 'SUPPRESS'`）。グループには追加しない。`UsernameExistsException` を `DirectoryError('EMAIL_EXISTS')` に変換する
    - _Requirements: 3.1, 3.2, 9.2_

  - [ ]* 8.4 `test/directory-cognito.test.js` の単体テストを書く
    - ページング、`Enabled=false` の除外、`name` 欠落時の代替、AdminCreateUser の入力、`UsernameExistsException` の変換
    - _Requirements: 3.1, 3.2, 9.2_

  - [ ] 8.5 テスト用のメモリ実装を作る（`test/helpers/memory-repo.js`、`test/helpers/fake-directory.js`）
    - メモリリポジトリは `Repo` と同じインターフェースと意味（`putRsvp` の `expectedDate` 確認、削除で回答も消すこと）を持ち、「ストアは変化しない」を比較できるように全項目のスナップショットを返す関数を持つ
    - フェイクディレクトリは `listMembers` と `createMember` を持ち、メールアドレスの大文字小文字を区別せずに重複を `DirectoryError('EMAIL_EXISTS')` で拒否し、呼び出し履歴と状態のスナップショットを返す
    - _Requirements: 3.2, 5.5, 8.3_

- [ ] 9. アプリ本体: 認証、画面配信、イベント操作
  - [ ] 9.1 `src/app.js` の `createApp(deps)` と `handle(event)` の骨格を実装する
    - 依存: `repo`、`directory`、`page`、`now`（既定 `() => new Date()`）、`newId`（既定 `crypto.randomUUID`）、`newPassword`（既定 `generateTemporaryPassword`）
    - `GET /` は `deps.page` の本文とヘッダーを返す。`/api/*` は `identityFromEvent` が `null` なら 401 `UNAUTHENTICATED` を返し、本文にデータを含めない
    - `route` の結果で処理関数を選び、404／405 を返す。`GET /api/me` を実装する
    - 例外をすべて捕捉し、`HttpError` はそのステータスに、それ以外は 500 `INTERNAL` と固定メッセージに変換する。ログには ID トークン、仮パスワード、リクエスト本文を出さない
    - _Requirements: 2.1, 2.2_

  - [ ]* 9.2 Property 1 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 1: 未認証の API リクエストはデータを返さない**
    - **Validates: Requirements 2.1**

  - [ ] 9.3 イベントの一覧・取得・登録・編集・削除の処理関数を `src/app.js` に追加する
    - 確認順序: 認証（401）→ 役割（403 `FORBIDDEN`）→ 本文の解析と入力検証（400）→ 存在（404 `EVENT_NOT_FOUND`）
    - `GET /api/events?scope=upcoming|past`（省略時 upcoming、不正値は 400 `BAD_REQUEST`）、`GET /api/events/{id}`、`POST /api/events`（201）、`PUT /api/events/{id}`、`DELETE /api/events/{id}`（204）
    - EventDetail は6項目、`dateLabel`、`acceptingResponses`（`isUpcoming`）、`myStatus`、`summary`（`directory.listMembers` と `summarize`）で組み立てる
    - 登録・編集・削除は部長だけに許可する。検証エラーのときはリポジトリを呼ばない
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.5, 6.1, 7.1, 7.2, 7.3, 7.4, 7.6, 9.1, 9.2_

  - [ ]* 9.4 Property 5 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 5: イベント登録のラウンドトリップと初期状態**
    - **Validates: Requirements 4.1, 4.6**

  - [ ]* 9.5 Property 9 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 9: 不正なイベント入力は登録でも編集でも保存されない**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 5.2**

  - [ ]* 9.6 Property 10 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 10: 編集は6項目を置き換え、出欠回答を保持する**
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 9.7 Property 11 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 11: 削除は対象イベントとその出欠回答だけを取り除く**
    - **Validates: Requirements 5.5**

  - [ ]* 9.8 Property 15 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 15: 一覧の各行は自分の回答を示す**
    - **Validates: Requirements 7.3**

- [ ] 10. アプリ本体: 出欠回答と部員アカウントの作成
  - [ ] 10.1 `PUT /api/events/{id}/rsvp` の処理関数を `src/app.js` に追加する
    - `validateRsvpInput` が失敗したら 400 `INVALID_RSVP`。イベントが無ければ 404、開催日が `todayJst(now)` より前なら 409 `RSVP_CLOSED`
    - `memberId` は本文ではなく claims の `sub` を使う。部長と部員の双方を受け付ける
    - `putRsvp` の結果が `not_found` なら 404、`changed` なら 409 `EVENT_CHANGED`。成功時は最新の EventDetail を返す
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.3_

  - [ ]* 10.2 Property 19 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 19: 出欠回答は1人1件で、最後の回答が反映される**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.3**

  - [ ]* 10.3 Property 20 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 20: 終了イベントへの回答は保存されない**
    - **Validates: Requirements 8.5**

  - [ ]* 10.4 Property 21 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 21: 不正な回答値は 400**
    - **Validates: Requirements 8.6**

  - [ ]* 10.5 Property 22 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 22: 回答の登録者はセッションのメンバー**
    - **Validates: Requirements 8.7**

  - [ ] 10.6 `POST /api/members` の処理関数を `src/app.js` に追加する
    - 部長のみ（部員は 403）。`validateMemberInput` が失敗したら 400 `VALIDATION_FAILED`
    - `newPassword()` で仮パスワードを作り `directory.createMember` を呼ぶ。`EMAIL_EXISTS` は 409 `EMAIL_EXISTS` に変換する
    - 201 `{ member: { email, name }, temporaryPassword }` を返す
    - _Requirements: 3.1, 3.2, 6.2_

  - [ ]* 10.7 Property 12 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 12: 部員の管理操作は 403 で何も変えない**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 10.8 Property 18 のプロパティテストを書く（`test/app.property.test.js`）
    - **Property 18: 存在しないイベントは 404**
    - **Validates: Requirements 7.6**

  - [ ]* 10.9 `test/app.test.js` の例ベースのテストを書く
    - 部員アカウント作成の 201 と仮パスワードの返却、重複メール（大文字小文字違いを含む）の 409、`GET /api/me`、405、壊れた JSON と 16 KB 超の本文の 400、500 のときに詳細を返さないこと
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 11. Checkpoint - API 層のテストがすべて通ることを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. ブラウザ側のセッション判定と描画関数
  - [ ] 12.1 `src/shared/session.js` を UMD 形式で実装する
    - `isTokenExpired(idToken, now)`: ペイロードを base64url デコードして `exp` を読み、`now + 60秒 >= exp` なら期限切れ。デコードできないトークンは期限切れとする
    - `resolveView(hash, session, now)`: セッションが無いか期限切れなら常に `login`。部員が `#/events/new`、`#/members/new` に来たら一覧、`#/events/{id}/edit` に来たら詳細に読み替える
    - `nextAuthStep(response)`: `AuthenticationResult` → `signed-in`、`NEW_PASSWORD_REQUIRED` → `new-password`、それ以外 → `error`
    - `mapAuthError(code)`: `NotAuthorizedException` と `UserNotFoundException` は同じ文言。`TooManyRequestsException`、`InvalidPasswordException` も設計の表どおりに変換する
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.2, 6.3_

  - [ ]* 12.2 Property 2 のプロパティテストを書く（`test/session.property.test.js`）
    - **Property 2: セッションが無効なら画面は常にログイン**
    - **Validates: Requirements 1.5, 2.2**

  - [ ]* 12.3 `nextAuthStep` と `mapAuthError` の例ベースのテストを書く（`test/session.property.test.js`）
    - AuthenticationResult → signed-in、NEW_PASSWORD_REQUIRED → new-password、ログイン失敗の2種類のエラーコードが同じ文言になること
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 12.4 `src/shared/render.js` を UMD 形式で実装する
    - `escapeHtml`（`& < > " '`）、`renderEventList`、`renderEventDetail`、`renderEventForm`、`renderMemberForm`、`renderLogin`、`renderNewPassword`。すべての値を `escapeHtml` に通す
    - 一覧の各行: 編名、`formatDateJa(date)`、集合時刻、自分の回答ラベル。開催予定が0件なら「開催予定のイベントはありません」
    - 詳細: 6項目、参加・不参加・未回答の人数と表示名の一覧、受付中なら出欠ボタン、終了なら「回答の受付は終了しました」
    - 管理用の操作部品には `data-action`（`create-event`、`edit-event`、`delete-event`、`create-member`）を付け、`role !== 'bucho'` のときは出力しない
    - フォームは `errors` の各項目のメッセージを該当項目の下に表示する。部員作成の完了表示では仮パスワードを1回だけ表示する
    - _Requirements: 3.1, 4.2, 5.4, 6.3, 7.3, 7.4, 7.5, 7.7, 8.5, 9.1, 9.2_

  - [ ]* 12.5 Property 13 のプロパティテストを書く（`test/render.property.test.js`）
    - **Property 13: 部員向けの画面には管理用の操作部品が無い**
    - **Validates: Requirements 6.3**

  - [ ]* 12.6 Property 16 のプロパティテストを書く（`test/render.property.test.js`）
    - **Property 16: 画面には必要な項目がエスケープされて含まれる**
    - **Validates: Requirements 7.3, 7.4, 9.1, 9.2**

  - [ ]* 12.7 描画関数の例ベースのテストを書く（`test/render.property.test.js`）
    - 0件の一覧の案内文、受付終了の表示、受付中の出欠ボタン
    - _Requirements: 7.7, 8.5_

- [ ] 13. ブラウザ側の制御と単一 HTML の組み立て
  - [ ] 13.1 `src/web/cognito-client.js` を UMD 形式で実装する
    - `fetch` を注入する。`cognitoEndpoint` に `Content-Type: application/x-amz-json-1.1` と `X-Amz-Target: AWSCognitoIdentityProviderService.<操作名>` で POST する
    - `initiateAuth`（`USER_PASSWORD_AUTH`）、`respondNewPassword`（`NEW_PASSWORD_REQUIRED`）、`refresh`（`REFRESH_TOKEN_AUTH`）、`revokeToken`。エラー応答は `__type` からエラーコードを取り出して返す
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [ ] 13.2 `src/web/index.html` と `src/web/style.css` を作る
    - HTML は骨組みだけで、設定 JSON・スタイル・スクリプトの差し込み位置と `<link rel="icon" href="data:,">` を持つ。部のデータは含めない
    - インラインの `style` 属性やイベントハンドラ属性は使わない（CSP で拒否されるため）。スマートフォン幅で読める画面にする
    - _Requirements: 2.2_

  - [ ] 13.3 `src/web/app.js` を実装する
    - `fetch`、`storage`、`confirm`、描画先、`location`、`now` を注入できるファクトリとして書き、ブラウザでは `bcg-config` を読んで起動する
    - セッションはローカルストレージの `bcg.session` に保存する。`hashchange` ごとに `resolveView` で画面を決め、`render.js` で描画する
    - API 呼び出しには `Authorization: Bearer <ID トークン>` を付ける。401 か `exp` 超過ならリフレッシュを1回試し、失敗したらセッションを消して期限切れの文言付きでログイン画面にする
    - ログイン、初回の新パスワード設定、ログアウト（`revokeToken` 後に保存トークンを削除してログイン画面）、一覧の upcoming／past の切り替え、詳細での出欠回答、部長のイベント登録・編集・削除、部員作成を扱う
    - 削除は `confirm('「{編名}」を削除します。出欠回答もすべて削除されます。よろしいですか？')` が OK のときだけ `DELETE` を送る
    - API のエラーコード（403、404、409、429 など）を設計の Error Handling 表の文言で表示する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 4.1, 4.2, 5.1, 5.4, 5.5, 6.3, 7.1, 7.2, 7.4, 7.6, 8.1, 8.2, 8.5, 9.3_

  - [ ]* 13.4 `test/web-app.test.js` の例ベースのテストを書く
    - `fetch`、`localStorage`、`confirm` をモックする
    - 削除確認で OK のときだけ DELETE を送ること、ログアウトで `RevokeToken` を呼び保存トークンを消してログイン画面になること、401 でリフレッシュを1回だけ試し失敗したらログイン画面になること
    - _Requirements: 1.4, 1.5, 5.4_

  - [ ] 13.5 `src/page.js` の `buildPage({ region, clientId })` を実装する
    - `web/index.html` に設定 JSON（`{ region, clientId, cognitoEndpoint: "https://cognito-idp.{region}.amazonaws.com/" }`、`<` は `\u003c`）、`style.css`、スクリプト（`shared/dates.js`、`shared/labels.js`、`shared/session.js`、`shared/render.js`、`web/cognito-client.js`、`web/app.js` の順）を差し込む
    - 各インラインスクリプトとスタイルの SHA-256 を `node:crypto` で計算し、Content-Security-Policy、Strict-Transport-Security、X-Content-Type-Options、Referrer-Policy、`Cache-Control: no-cache` を付けた `{ body, headers }` を返す
    - ファイルの読み込みは `__dirname` 基準で行い、呼び出し時に1回だけ組み立てる
    - _Requirements: 2.2, 2.5, 10.5_

  - [ ]* 13.6 `test/page.test.js` の例ベースのテストを書く
    - HTML 内の各スクリプトとスタイルのハッシュが CSP と一致すること、設定 JSON のエスケープ、セキュリティヘッダー、`cognitoEndpoint` が `https://` で始まること
    - _Requirements: 2.5_

- [ ] 14. Lambda エントリ、デプロイ定義、運用手順
  - [ ] 14.1 `src/handler.js` を実装する
    - 設計どおり、AWS SDK の DynamoDB／Cognito クライアントを作り、`createDynamoRepo`、`createCognitoDirectory`、`buildPage` を `createApp` に注入する。SDK を `require` するのはこのファイルだけ
    - 環境変数 `TABLE_NAME`、`USER_POOL_ID`、`USER_POOL_CLIENT_ID`、`AWS_REGION` を読む。認証情報はソースに書かない
    - `exports.handler = (event) => app.handle(event)`
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ] 14.2 `cloud-service/template.json`（AWS SAM、JSON 形式）を作る
    - UserPool（`UserPoolTier: LITE`、`UsernameAttributes: ["email"]`、大文字小文字を区別しない、`AllowAdminCreateUserOnly: true`、パスワードポリシーと仮パスワード有効期限7日、`email` と `name` 必須）、UserPoolClient（シークレットなし、`ALLOW_USER_PASSWORD_AUTH`／`ALLOW_REFRESH_TOKEN_AUTH`、`PreventUserExistenceErrors: ENABLED`、`EnableTokenRevocation: true`、ID／アクセス60分、リフレッシュ30日）、BuchoGroup
    - Table（`PROVISIONED` 5/5、`pk`／`sk`、GSI なし）
    - HttpApi（JWT オーソライザー、`DefaultRouteSettings` のスロットリング 5/20）、AppFunction（`nodejs20.x`、`handler.handler`、`CodeUri: src/`、256 MB、10秒、環境変数、`GET /` は認可なし、`ANY /api/{proxy+}` は JWT）、AppFunctionLogGroup（保持14日）
    - 実行ロールは設計に列挙した DynamoDB 操作、`cognito-idp:ListUsers`、`cognito-idp:AdminCreateUser`、ログ書き込みだけに絞る。Outputs に API の URL、ユーザープール ID、クライアント ID を出す
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5, 3.3, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 14.3 `test/template.smoke.test.js` のスモークテストを書く
    - `template.json` を `JSON.parse` し、Runtime `nodejs20.x`、リソース種別が許可リスト内で EC2・RDS などが無いこと、`AllowAdminCreateUserOnly: true`、`PreventUserExistenceErrors: ENABLED`、`UserPoolTier: LITE`、テーブルが `PROVISIONED` で容量合計 25 以下、スロットリング設定、`/api/{proxy+}` に JWT オーソライザーがあることを確認する
    - _Requirements: 1.2, 2.1, 2.3, 2.4, 10.1, 10.2, 10.3, 10.4_

  - [ ] 14.4 `cloud-service/scripts/create-bucho.sh` を作る
    - 引数でスタック名（またはユーザープール ID）、メールアドレス、表示名を受け取り、`aws cognito-idp admin-create-user`（`MessageAction SUPPRESS`、仮パスワード指定）と `admin-add-user-to-group --group-name bucho` を実行する
    - 仮パスワードはスクリプト内で生成して標準出力に1回だけ表示する。`set -euo pipefail`、変数はすべてクォートし、認証情報は AWS CLI の既定の設定から取得する
    - _Requirements: 3.1, 3.3, 10.5_

  - [ ] 14.5 `cloud-service/README.md` を作る
    - `npm test` の実行方法、`sam deploy --template-file template.json --guided` によるデプロイ、`create-bucho.sh` による最初の部長の作成、AWS Budgets の月 1 USD 予算アラート、`admin-set-user-password --no-permanent` による仮パスワード再発行
    - 設計の「自動テストの対象外」にあるデプロイ後の手動確認チェックリストと、API Gateway の12か月経過後の費用見込み
    - _Requirements: 3.1, 10.3_

  - [ ]* 14.6 `test/isolation.smoke.test.js` のスモークテストを書く
    - `fixtures/flyer-assets.sha256` に記載した収集規則で既存フライヤー資産を集め直し、ファイル集合とハッシュがマニフェストと一致すること
    - `src/` と `test/` が `cloud-service/` の外を `require` していないこと、`@aws-sdk/*` を `require` するのが `src/handler.js` だけであること
    - `src/` に `AKIA[0-9A-Z]{16}` などの認証情報らしき文字列が無いこと
    - `package.json` に `dependencies` が無く、`scripts.test` が `node --test` であること
    - _Requirements: 10.5, 11.1, 11.2, 11.3_

- [ ] 15. Final checkpoint - すべてのテストが通ることを確認する
  - `cloud-service/` で `npm test` を実行する（ウォッチモードは使わない）
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` 付きのタスクは省略可能なテストで、MVP を急ぐ場合は飛ばせる。ただし省略しても 1.3、1.4、8.5 のテスト補助は実装する
- 各タスクは要件番号を参照しており、23個の性質はそれぞれ独立したサブタスクとして実装箇所の直後に置いている
- プロパティテストは各性質について最低100回試行し、テスト名と先頭コメントに `Feature: cloud-service, Property N: <性質名>` のタグを付ける。失敗時は表示された seed を `PBT_SEED` に指定して再現する
- テストは AWS に接続しない。ローカルに AWS SDK が無くても `npm test` が通る構成を保つ
- 既存フライヤー資産には書き込まない。1.1 のマニフェスト作成は読み取りだけで行う
- デプロイ後の実環境での確認（実際の Cognito ログイン、`SignUp` の拒否、HTTP でのアクセス不可、無料利用枠の使用状況）は自動テストの対象外で、14.5 の README のチェックリストに記載する

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.3", "4.1", "4.3", "7.1", "7.2"] },
    { "id": 3, "tasks": ["1.4", "1.5", "3.1", "5.1", "8.1", "8.3", "12.1", "12.4", "13.1", "13.2"] },
    { "id": 4, "tasks": ["2.2", "3.2", "4.2", "4.4", "5.3", "8.2", "8.4", "8.5", "12.2", "12.5", "13.3"] },
    { "id": 5, "tasks": ["3.3", "5.2", "9.1", "12.3", "12.6", "13.4", "13.5"] },
    { "id": 6, "tasks": ["3.4", "9.2", "9.3", "12.7", "13.6"] },
    { "id": 7, "tasks": ["9.4", "10.1"] },
    { "id": 8, "tasks": ["9.5", "10.6"] },
    { "id": 9, "tasks": ["9.6", "10.9", "14.1", "14.2", "14.4"] },
    { "id": 10, "tasks": ["9.7", "14.3", "14.5"] },
    { "id": 11, "tasks": ["9.8", "14.6"] },
    { "id": 12, "tasks": ["10.2"] },
    { "id": 13, "tasks": ["10.3"] },
    { "id": 14, "tasks": ["10.4"] },
    { "id": 15, "tasks": ["10.5"] },
    { "id": 16, "tasks": ["10.7"] },
    { "id": 17, "tasks": ["10.8"] }
  ]
}
```
