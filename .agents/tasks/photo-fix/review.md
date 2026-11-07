# Client-side photo normalization and upload error check

アップロード前に写真をEXIFの向き反映・長辺1600px以下・JPEG化し、S3へのPUT失敗を検出するようにした。新規 `app/src/services/image.ts` と `uploadPhoto`（`app/src/services/api.ts`）の変更のみで、CSSとバックエンドは触っていない。実機で症状を再現できていないため、原因はコード読解による推定であり、修正の目的は「端末で表示できない/向きが崩れる/壊れたURLが保存される」経路を塞ぐこと。

Watch for: (1) 変換失敗時は `RecordModal` の空の `catch {}` により、写真なしで黙って投稿される（likely、既存挙動で今回の差分外だが、HEIC等の失敗がユーザーに見えない）。(2) S3バケットの公開読み取り/CORSは未確認で、非公開なら今回の修正後も表示されない（possible、コードから確認不能）。(3) 投稿済みの写真は修正されない（confirmed、再投稿が必要）。

**Verdict**: APPROVED

## High-level view

推定された原因はコードと整合する。`uploadPhoto` は以前、選択ファイルを無加工でPUTし、PUTの結果も見ていなかった。そのため、大きな端末写真、ブラウザが表示できない形式、失敗したPUTの後に保存される壊れた `imageUrl` のいずれも起こり得た。

修正はアップロード直前にcanvasでJPEGへ再エンコードする方式である。`<img>` のデコードは現行のSafari/Chromeで既定でEXIFの向きを反映するので、再エンコード後の画像は向きが焼き込まれる。presigned URLのContent-Typeとキー拡張子は常に `image/jpeg` / `.jpg` で揃い、署名時の ContentType とPUT時のヘッダーも一致する。`!res.ok` で例外を投げるため、壊れたURLは保存されなくなる。

CSS（`PostCard` の `aspect-square object-cover`、`MyPage` の `object-cover`）は表示側の切り抜きとして意図通りで、変更しなかった判断は妥当。変更は2ファイルに収まり、無関係なリファクタ、`.env.local`、シークレットの変更は見当たらない。フロントエンドのみ再デプロイが必要という記述は正しい。

<details>
<summary>Issues (4)</summary>

1. **Silent upload failure** — `RecordModal.tsx` の `try { imageUrl = await uploadPhoto(photoFile) } catch {}` により、変換/アップロード失敗は無通知で写真なし投稿になる（likely）。今回の変更で失敗が発生しやすい経路（デコード不可のHEIC）が増えたため、後続でユーザーへの通知を検討する。ブロッキングではない。
2. **S3 public read / CORS unverified** — バケット `bescon-gourmet-uploads-...` の公開設定は未確認（possible）。表示されない場合は、サンプル投稿のimageUrlをブラウザで直接開き、403かどうかを確認する。
3. **Existing posts not repaired** — 既存の投稿写真は元のまま。必要なら再投稿を案内する（confirmed）。
4. **No on-device verification** — canvas変換は実機（iPhone/Android）で未検証。デプロイ後に縦撮り写真と大きな写真で確認する（confirmed）。

</details>

<details>
<summary>Details</summary>

## Upload path: from raw file PUT to normalized JPEG

バックエンドの `GET /uploads/presigned-url`（`backend/src/index.js` 85-95行）は `contentType` クエリからキーの拡張子を決め、`ContentType` を署名に含める。修正前のクライアントは任意のMIMEを渡し得たため、HEICでは拡張子 `.jpg` とContent-Type `image/heic` という不整合が起こり得た。修正後は常に `image/jpeg` を渡すので、署名・キー・PUTヘッダーが一致し、バックエンド変更は不要である。

`normalizePhoto` は、白背景を敷いてからJPEG品質0.85で出力する。透過PNGが黒くなる問題への対処で、必要十分。縮小は `min(1, 1600/長辺)` なので拡大はしない。1600pxに縮小するため、iOSのcanvas面積上限にも掛かりにくい。

HEICをデコードできないブラウザでは `loadImage` が拒否され、写真なしで投稿される。メモにも記載済みで、Safariはピッカー側でJPEGに変換するのが通常のため、主要端末では影響は小さい（possible）。

## Evidence and scope

`impl-notes.md` に原因、実行コマンド（build/lint成功）、未確認事項、再デプロイ要否が揃っている。ワークスペースはgit管理外なので差分は直接取れず、ファイルの内容とタイムスタンプで確認した。`image.ts` と `api.ts` は19:16の更新で、このタスクの変更と一致する。`backend/src/index.js`（19:00）と `lambda.zip`、`MyPage.tsx`（19:01）はこのタスク開始（19:18）より前の更新であり、メモの「バックエンド変更なし」と矛盾しない。ただし変更前の状態と比較できないため、この点は更新時刻に基づく判断である。`.env.local` の更新時刻は11/6で、今回触れていない。

</details>

<details>
<summary>File map</summary>

- `app/src/services/image.ts` — 新規。EXIF向き反映、1600px縮小、JPEG再エンコード
- `app/src/services/api.ts` — `uploadPhoto` が正規化後のBlobをPUTし、`!res.ok` で例外
- `app/dist/*` — ビルド成果物（再デプロイ対象）

差分はgit管理外のため、上記ファイルを直接参照する。

</details>
