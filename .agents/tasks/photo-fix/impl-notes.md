# photo-fix 実装メモ

## 原因（コードから特定。実機では未再現）
具体的な症状の指定がなかったため、コードを読んで次の問題を特定した。

1. `uploadPhoto`（app/src/services/api.ts）が選択ファイルをそのままS3へPUTしていた。
   - 数MBの端末写真が無加工でアップロードされ、読み込みが遅く、失敗しやすい。
   - HEIC/HEIFなどブラウザが表示できない形式がそのまま保存され、`<img>`で表示できない。拡張子は`jpg`、Content-Typeは`image/heic`となる不整合も起きる。
   - EXIFの向きを保存画像側で正規化していない。EXIFが残るため、EXIFを無視する環境では横向きに表示される。
2. PUTのレスポンスを確認していなかった。S3が403等を返してもアップロード成功扱いになり、存在しないURLが`imageUrl`として投稿に保存され、画像が壊れて表示される。
3. CSS（PostCardの`aspect-square object-cover w-full`、MyPageの`object-cover`）は問題なし。変更していない。
4. 未確認：S3バケットの公開設定/CORS（`imageUrl`は`https://<bucket>.s3...amazonaws.com/...`の直接URL）。バケットが非公開だと閲覧時に403になる。コードからは確認できず、AWSにも接続していない。

## 修正内容
- 新規 `app/src/services/image.ts`：`normalizePhoto(file)`。`<img>`でデコードしてEXIFの向きを反映し、長辺1600px以下に縮小して、白背景のcanvasからJPEG（品質0.85）に再エンコードする。
- `app/src/services/api.ts`：`uploadPhoto`で`normalizePhoto`の結果（`image/jpeg`）をアップロードし、PUTが`!res.ok`ならエラーを投げる。
- 呼び出し側（RecordModal、MyPage）は既存の`catch`のまま。失敗時は写真なしで投稿される従来の挙動で、壊れたURLは保存されなくなる。

## 実行したコマンド
- `cd app && npm run build` → 成功（tsc + vite build）
- `cd app && npm run lint`（oxlint）→ 成功。警告は既存コードのもののみ（react-hooks系）で、変更ファイル由来の警告なし。
- 画像ヘルパーはcanvas/DOMが必要で、node単体では実行できない。縮小倍率の計算（`min(1, 1600/長辺)`）はコードレビューで確認したのみ。

## 実機で未確認の点
- iPhone/Androidでの縦横の向き、HEIC選択時の挙動（Safariは通常ピッカーがJPEGに変換する。HEICをデコードできないブラウザでは変換エラーになり、写真なしで投稿される）。
- S3バケットのパブリック読み取り/CORS設定。
- 既に投稿済みの写真は修正されない（再投稿が必要）。

## 再デプロイ
- フロントエンドの再デプロイ：必要（build後のdistをS3/CloudFrontへ）。
- バックエンド：不要（変更なし）。

## その他
- ワークスペースはgitリポジトリではないため、コミットしていない。
