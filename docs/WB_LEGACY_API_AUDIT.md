# Wildberries Legacy API Audit

Legacy path audited: `strawberry-backend/src/main/java/com/strawberry/ecommerce/wb`.

Legacy files found:

- `client/WildberriesApiClient.java`
- `controller/WbIntegrationController.java`
- `dto/IntegrationResponseDto.java`
- `dto/UpdateIntegrationRequest.java`
- `dto/WbCardsRequestDto.java`
- `dto/WbCardsResponseDto.java`
- `entity/ShopWbIntegration.java`
- `repository/ShopWbIntegrationRepository.java`
- `service/WbIntegrationService.java`

## Endpoint And Auth

Legacy uses:

- `POST https://content-api.wildberries.ru/content/v2/get/cards/list`

Headers:

- `Authorization: <WB seller API key>`
- `Content-Type: application/json`

No API key value was copied into this document.

## DTOs

`WbCardsRequestDto` sends:

- `settings.sort.ascending`
- `settings.cursor.limit`
- `settings.cursor.updatedAt`
- `settings.cursor.nmID`
- `settings.filter.withPhoto`

`WbCardsResponseDto` receives:

- `cards[]`
- `cursor.updatedAt`
- `cursor.nmID`
- `cursor.total`

Card fields include `nmID`, `imtID`, `nmUUID`, `subjectID`, `subjectName`, `vendorCode`, `brand`, `title`, `description`, `video`, `needKiz`, timestamps, `photos`, `dimensions`, `characteristics`, `sizes`, `tags`, and `wholesale`.

Variant/size fields include `chrtID`, `techSize`, `wbSize`, and `skus`.

Image fields include `big`, `c246x328`, `c516x688`, `hq`, `square`, and `tm`.

## Credentials

Legacy stores shop-scoped credentials in `ShopWbIntegration.apiKeyEncrypted` and returns only integration metadata. It also tracks cursors, last sync status, pause flags, next expected sync time, failure count, and duration.

## Reused Ideas

- Use Content API cards list.
- Keep WB credentials shop-scoped.
- Do not return or log API keys.
- Use `vendorCode` as article/APT/seller SKU.
- Use `nmID` as WB product id.
- Use cursor `updatedAt + nmID` for future pagination.
- Use `sizes[].chrtID`, `techSize`, `wbSize`, and `skus` for variants.
- Use remote photo URLs for MVP images.

## Not Copied Directly

- Spring/JPA implementation details.
- Legacy scheduler/advisory-lock flow.
- Legacy encryption utility, because it does not exist in `backend-nest`.
- Any product upsert logic, because the current Prisma schema and seller workflow differ.

## Current Mapping Notes

- `vendorCode` -> `sellerSku`, `wbVendorCode`
- `nmID` -> `wbNmId`, `externalProductId`
- `imtID` -> `wbImtId`
- `nmUUID` -> `wbNmUuid`
- `title` -> `wbTitle`, `localTitle`
- `description` -> `wbDescription`, `localDescription`
- `subjectName` -> `categoryName`
- `subjectID` -> `subjectId`
- `photos` -> remote `product_images`
- `sizes[].chrtID` -> variant `chrtId`
- `sizes[].techSize` -> variant `techSize`, `sizeName`
- `sizes[].wbSize` -> variant `wbSize`, `russianSize`
- first `sizes[].skus[]` -> variant `wbBarcode`

Price and stock are not present in the audited Content API cards response and need separate WB APIs in a later phase.
