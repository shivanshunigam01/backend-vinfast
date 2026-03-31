# Patliputra Auto × VinFast Backend

Fully structured Node.js + Express + MongoDB backend based on the provided API documentation.

## Includes
- Public APIs for config, products, hero slides, offers, banners, FAQs, testimonials
- Public form APIs for leads, test drives, enquiries
- Admin JWT auth APIs
- Admin CRUD for leads, test drives, enquiries, products, offers, homepage, content, media
- Dashboard stats API
- Cloudinary media deletion support
- Validation, pagination, central error handling
- Seed script for first admin

## Run
```bash
npm install
cp .env.example .env
npm run seed:admin
npm run dev
```

## Frontend Cloudinary note
Your frontend `.env` remains:
```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here
```

That frontend unsigned upload setup is separate from the backend.
