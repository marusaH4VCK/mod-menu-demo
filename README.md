# Mod Menu Demo — IPA Build Guide

UI Demo เท่านั้น | ไม่มี offset จริง

---

## วิธีที่ 1: EAS Build (ง่ายสุด — ไม่ต้องมี Mac เอง)

### ขั้นตอน:

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. ติดตั้ง EAS CLI
npm install -g eas-cli

# 3. login Expo account (สมัครฟรีที่ expo.dev)
eas login

# 4. เชื่อม project กับ Expo
eas init

# 5. Build IPA (ต้องมี Apple Developer account)
eas build --platform ios --profile preview
```

EAS จะ build บน cloud ของ Expo แล้วส่ง link ดาวน์โหลด IPA ให้ทาง email ครับ

---

## วิธีที่ 2: GitHub Actions (ต้องมี Apple cert เอง)

### 1. Push ขึ้น GitHub

```bash
git init
git add .
git commit -m "mod menu demo"
git remote add origin https://github.com/ชื่อ/repo.git
git push -u origin main
```

### 2. ใส่ Secrets ใน GitHub (Settings → Secrets → Actions)

| Secret | ได้มาจาก |
|--------|---------|
| `BUILD_CERTIFICATE_BASE64` | Export .p12 จาก Keychain บน Mac → `base64 -i cert.p12 \| pbcopy` |
| `P12_PASSWORD` | password ตอน export .p12 |
| `BUILD_PROVISION_PROFILE_BASE64` | ดาวน์โหลด .mobileprovision จาก Apple Developer → `base64 -i xxx.mobileprovision \| pbcopy` |
| `KEYCHAIN_PASSWORD` | กำหนดเองได้ เช่น `mypassword123` |
| `CODE_SIGN_IDENTITY` | เช่น `Apple Distribution: Your Name (ABC1234DEF)` |
| `PROVISIONING_PROFILE_NAME` | ชื่อ profile ที่ตั้งใน Apple Developer Portal |
| `APPLE_TEAM_ID` | ดูได้ที่ developer.apple.com/account → Membership |

### 3. ดาวน์โหลด IPA

GitHub → Actions tab → workflow run → Artifacts → `mod-menu-ipa`

---

## DEV_MODE

`components/ModMenu.tsx` บรรทัดแรก:

```typescript
const DEV_MODE = true;   // test ได้ปกติ ไม่โดน block
const DEV_MODE = false;  // เปิดป้องกัน inject จริง ก่อน build release
```

---

## โครงสร้าง

```
standalone-mod-menu/
├── components/ModMenu.tsx   ← แก้ features/tabs ได้ที่นี่
├── app/(tabs)/index.tsx     ← หน้าหลัก
├── eas.json                 ← EAS Build config
├── .github/workflows/       ← GitHub Actions
└── app.json                 ← bundle ID, app name
```
