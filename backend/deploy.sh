#!/bin/bash
set -e
REGION=ap-northeast-1
ACCOUNT=897729110502
FUNCTION=bescon-api
ROLE=bescon-lambda-role
API_NAME=bescon-api-gateway

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
             "GET /goals" "POST /goals" "PUT /goals/{goalId}" "DELETE /goals/{goalId}" \
             "GET /me" "PUT /me" "GET /members" "GET /members/{userId}"; do
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
