# Homepage Slides API Specification

The Homepage Slides API provides endpoints to manage visual image banner slides displayed on the public marketplace homepage. It separates customer (public) endpoints and admin-only management endpoints.

## Customer (Public) Endpoint

### Get Public Homepage Slides
Retrieves the list of active slides to display in the main slider.

* **Endpoint**: `GET /api/public/homepage-slides`
* **Authentication**: None (Public)
* **Response Policy**: Public-safe fields only (strips administrative metadata).
* **Sorting Policy**: Sorted by `displayOrder` ascending, then `createdAt` descending.
* **Publishing Visibility Rules**:
  * Slide must be `isActive = true`.
  * `startsAt` must be `null` or `startsAt <= now`.
  * `endsAt` must be `null` or `endsAt >= now`.

#### Request
```http
GET /api/public/homepage-slides HTTP/1.1
Host: localhost:3001
Accept: application/json
```

#### Response (200 OK)
```json
[
  {
    "id": "d070b471-1111-4111-8111-111111111111",
    "titleRu": "Распродажа платьев",
    "titleEn": "Summer Dresses Sale",
    "subtitleRu": "Скидки до 50% на все платья из льна",
    "subtitleEn": "Up to 50% off on all linen dresses",
    "ctaLabelRu": "Купить",
    "ctaLabelEn": "Shop Now",
    "ctaUrl": "/products?category=dresses",
    "altTextRu": "Слайд платья",
    "altTextEn": "Dresses Slide",
    "imageDesktopUrl": "http://localhost:3000/demo/demo-product-1.svg",
    "imageMobileUrl": "http://localhost:3000/demo/demo-product-1.svg",
    "backgroundColor": "linear-gradient(135deg, #cb11ab 0%, #8e1cff 100%)",
    "displayOrder": 1
  }
]
```

---

## Admin Management Endpoints

All admin endpoints require an active Admin session token passed as a Bearer token.

### List Homepage Slides
Retrieves all slides, including inactive ones and administrative metadata.

* **Endpoint**: `GET /api/admin/homepage-slides`
* **Authentication**: Bearer (Role: `ADMIN`)
* **Response (200 OK)**:
```json
[
  {
    "id": "d070b471-1111-4111-8111-111111111111",
    "titleRu": "Распродажа платьев",
    "titleEn": "Summer Dresses Sale",
    "subtitleRu": "Скидки до 50% на все платья из льна",
    "subtitleEn": "Up to 50% off on all linen dresses",
    "ctaLabelRu": "Купить",
    "ctaLabelEn": "Shop Now",
    "ctaUrl": "/products?category=dresses",
    "altTextRu": "Слайд платья",
    "altTextEn": "Dresses Slide",
    "imageDesktopUrl": "http://localhost:3000/demo/demo-product-1.svg",
    "imageDesktopStorageKey": null,
    "imageMobileUrl": "http://localhost:3000/demo/demo-product-1.svg",
    "imageMobileStorageKey": null,
    "backgroundColor": "linear-gradient(135deg, #cb11ab 0%, #8e1cff 100%)",
    "displayOrder": 1,
    "isActive": true,
    "startsAt": "2026-05-01T00:00:00.000Z",
    "endsAt": "2026-08-31T23:59:59.000Z",
    "createdAt": "2026-05-26T00:00:00.000Z",
    "updatedAt": "2026-05-26T00:00:00.000Z"
  }
]
```

### Get Slide Detail
Retrieves detailed information of a specific slide.

* **Endpoint**: `GET /api/admin/homepage-slides/:id`
* **Authentication**: Bearer (Role: `ADMIN`)

### Create Homepage Slide
Creates a new slide.

* **Endpoint**: `POST /api/admin/homepage-slides`
* **Authentication**: Bearer (Role: `ADMIN`)
* **Payload Validation**:
  * `imageDesktopUrl` is required.
  * If both `startsAt` and `endsAt` are provided, `startsAt` must be before `endsAt`.

#### Request Body
```json
{
  "titleRu": "Новый Баннер",
  "titleEn": "New Banner",
  "imageDesktopUrl": "https://example.com/desktop.png",
  "imageMobileUrl": "https://example.com/mobile.png",
  "isActive": true,
  "displayOrder": 1,
  "startsAt": "2026-06-01T00:00:00.000Z",
  "endsAt": "2026-06-30T00:00:00.000Z"
}
```

### Update Homepage Slide
Updates an existing slide.

* **Endpoint**: `PATCH /api/admin/homepage-slides/:id`
* **Authentication**: Bearer (Role: `ADMIN`)

### Delete Homepage Slide
Deletes a slide from the database.

* **Endpoint**: `DELETE /api/admin/homepage-slides/:id`
* **Authentication**: Bearer (Role: `ADMIN`)

### Toggle Active Status
Quickly switches a slide's active state.

* **Endpoint**: `POST /api/admin/homepage-slides/:id/toggle`
* **Authentication**: Bearer (Role: `ADMIN`)
* **Response (200 OK)**: Returns the updated slide object.

### Reorder Homepage Slides
Bulk updates the sorting order of multiple slides.

* **Endpoint**: `POST /api/admin/homepage-slides/reorder`
* **Authentication**: Bearer (Role: `ADMIN`)
* **Request Body**:
```json
{
  "orders": [
    { "id": "d070b471-1111-4111-8111-111111111111", "displayOrder": 2 },
    { "id": "d070b472-2222-4222-8222-222222222222", "displayOrder": 1 }
  ]
}
```

### Upload Image
Uploads slide assets directly to S3/Minio object storage.

* **Endpoint**: `POST /api/admin/homepage-slides/upload`
* **Authentication**: Bearer (Role: `ADMIN`)
* **Format**: Multipart form data with file key `file`.
* **Validation Rules**:
  * Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
  * SVG and Video uploads are strictly forbidden.
  * Maximum file size: 5MB.
