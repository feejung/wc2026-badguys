# คนซั่วๆ World Cup 2026 — Predictor

แอพบันทึกผลทายบอลโลก พร้อมระบบราคาต่อ/รอง คำนวณยอดได้-เสียอัตโนมัติ

## วิธีรันบนเครื่องตัวเอง (ทดสอบก่อน)

```bash
npm install
npm run dev
```

## วิธีอัปโหลดขึ้น GitHub

1. สร้าง repo ใหม่บน GitHub (เช่น `wc2026-predictor`) — ไม่ต้องติ๊ก "Add README"
2. เปิด Terminal ในโฟลเดอร์นี้ แล้วรัน:

```bash
git init
git add .
git commit -m "Initial commit: WC2026 predictor"
git branch -M main
git remote add origin https://github.com/<ชื่อ-user>/<ชื่อ-repo>.git
git push -u origin main
```

## วิธีแชร์ผ่าน Netlify

### วิธีที่ 1: ลากไฟล์วาง (เร็วที่สุด ไม่ต้องใช้ GitHub)
1. รัน `npm install && npm run build` จะได้โฟลเดอร์ `dist/`
2. เข้า https://app.netlify.com/drop
3. ลากโฟลเดอร์ `dist` ไปวาง → ได้ลิงก์ทันที

### วิธีที่ 2: เชื่อมกับ GitHub (อัปเดตอัตโนมัติทุกครั้งที่ push)
1. เข้า https://app.netlify.com → "Add new site" → "Import an existing project"
2. เลือก GitHub แล้วเลือก repo ที่ push ไว้
3. ตั้งค่า build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. กด Deploy

## หมายเหตุ
- ข้อมูลที่กรอกจะถูกเก็บไว้ใน `localStorage` ของเบราว์เซอร์ผู้ใช้แต่ละเครื่อง (ไม่ sync ข้ามอุปกรณ์)
- ลบรายการต้องใส่รหัสผ่าน `888`
