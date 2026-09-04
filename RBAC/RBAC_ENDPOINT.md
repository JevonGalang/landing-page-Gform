# Dokumentasi Endpoint RBAC

## Autentikasi

Semua endpoint pada dokumen ini wajib mengirim JWT hasil dari `POST /post/login`.

```http
Authorization: Bearer <token>
```

Role dan lab yang dapat diakses:

| Role | Lab yang dapat diakses |
| --- | --- |
| `admin` | Seluruh lab |
| `yusuf` | LAB JARINGAN KOMPUTER (9), LAB MULTI MEDIA 1 (11), LAB MULTI MEDIA 2 (12) |
| `ahmad` | LAB MATEMATIKA (1), LAB APLIKASI 1 (2), LAB APLIKASI 2 (3) |
| `ade` | LAB PROGRAMMING (13), LAB SISTEM DIGITAL (14), RUANG RISET SISTEM OPERASI (18) |

Jika token tidak dikirim, response:

```json
{
  "pesan": "username not exit"
}
```

Status: `401 Unauthorized`.

Jika token tidak valid atau sudah habis, response:

```json
{
  "message": "Token tidak valid"
}
```

Status: `403 Forbidden`.

Jika user mencoba mengakses lab yang bukan miliknya, response:

```json
{
  "pesan": "Anda tidak memiliki akses ke laboratorium ini"
}
```

Status: `403 Forbidden`.

## Endpoint Login

### `POST /post/login`

Endpoint ini terbuka untuk mendapatkan token JWT.

Request body:

```json
{
  "username": "pak yusuf",
  "password": "password-user"
}
```

Response sukses:

```json
{
  "users": {
    "userId": 1,
    "username": "pak yusuf",
    "role": "yusuf"
  },
  "token": "jwt-token",
  "status": 200
}
```

## Endpoint Publik Mahasiswa Tanpa JWT

Mahasiswa tidak memerlukan akun untuk dua endpoint berikut. Endpoint petugas yang lama tetap memakai JWT dan RBAC.

### `GET /get/public/jadwal`

Menampilkan seluruh jadwal aktif agar mahasiswa dapat memilih jadwal untuk diisi logbook.

Request body dan header JWT: tidak diperlukan.

Contoh response:

```json
{
  "message": [
    {
      "id": 101,
      "lab_id": 11,
      "nama_lab": "LAB MULTI MEDIA 1",
      "matkul": "Multimedia",
      "tanggal": "2026-08-01",
      "jammulai": "08:00",
      "jamselesai": "10:00"
    }
  ],
  "status": 200,
  "token": "none"
}
```

### `POST /post/public/logbook`

Mahasiswa mengisi logbook untuk jadwal yang dipilih. JWT tidak diperlukan. Sistem tetap memvalidasi bahwa jadwal tersedia dan jumlah peserta tidak melebihi kapasitas lab.

Request body:

```json
{
  "schadule": 101,
  "namaKetua": "Nama Mahasiswa",
  "nim": "12345678",
  "kelas": "TI 1A",
  "jumlahPeserta": 25,
  "nomorWa": "08123456789"
}
```

Response sukses:

```json
{
  "message": {
    "insertId": 20,
    "affectedRows": 1
  },
  "status": 200,
  "token": "none"
}
```

Endpoint ini memakai batas maksimal 5 request per IP dalam 15 menit untuk mencegah spam. Jika batas tercapai, response:

```json
{
  "message": "Terlalu banyak permintaan, silakan coba lagi nanti."
}
```

Status: `429 Too Many Requests`.

## Informasi Akses User

### `GET /get/rbac/saya`

Role yang diizinkan: `admin`, `yusuf`, `ahmad`, `ade`.

Request body: tidak ada.

Response sukses untuk Yusuf:

```json
{
  "message": {
    "user": {
      "id": 1,
      "username": "pak yusuf",
      "role": "yusuf"
    },
    "akses_semua_lab": false,
    "labs": [
      {
        "id_lab": 9,
        "nama_lab": "LAB JARINGAN KOMPUTER"
      }
    ]
  },
  "status": 200,
  "token": "none"
}
```

## Daftar Data yang Difilter Berdasarkan Role

Endpoint berikut hanya mengembalikan data dari lab milik role pada token. Admin menerima seluruh data.

| Method | Endpoint | Request | Response utama |
| --- | --- | --- | --- |
| `GET` | `/get` | Tidak ada body | Jadwal aktif beserta data lab |
| `GET` | `/get/penggunaanlab` | Tidak ada body | Jadwal aktif beserta data lab |
| `GET` | `/get/lab` | Tidak ada body | Daftar lab yang boleh diakses |
| `GET` | `/get/jadwal` | Tidak ada body | Daftar jadwal lab yang boleh diakses |
| `GET` | `/get/jadwal/jenis/:jenis_lab` | Parameter jenis lab | Jadwal pada jenis lab yang masih termasuk akses user |
| `GET` | `/get/jadwal/:jadwal` | Parameter jenis lab | Sama seperti endpoint jenis lab |
| `GET` | `/get/logbook` | Tidak ada body | Logbook yang terhubung ke lab yang boleh diakses |
| `GET` | `/get/history/schadule` | Query filter opsional | History jadwal lab yang boleh diakses |
| `GET` | `/get/history/logbook` | Query filter opsional | History logbook lab yang boleh diakses |

Contoh response `GET /get/jadwal`:

```json
{
  "message": [
    {
      "id": 101,
      "lab_id": 11,
      "nama_lab": "LAB MULTI MEDIA 1",
      "matkul": "Multimedia",
      "tanggal": "2026-08-01",
      "jammulai": "08:00",
      "jamselesai": "10:00"
    }
  ],
  "status": 200,
  "token": "none"
}
```

## Persentase Penggunaan Lab

Semua endpoint persentase wajib JWT dan hasilnya hanya untuk lab yang dapat diakses user.

| Method | Endpoint | Query opsional |
| --- | --- | --- |
| `GET` | `/get/lab/persentase` | `operasional`, `pekan`, `jenis`, `onlyAuto` |
| `GET` | `/get/lab/persentase-semester` | `operasional`, `pekan`, `jenis`, `onlyAuto` |
| `GET` | `/get/persentase-lab` | `operasional`, `pekan`, `jenis`, `onlyAuto` |

Contoh request:

```http
GET /get/lab/persentase?pekan=16&onlyAuto=true
Authorization: Bearer <token-yusuf>
```

Contoh response:

```json
{
  "message": [
    {
      "id_lab": 11,
      "nama_lab": "LAB MULTI MEDIA 1",
      "total_jadwal_terikat_logbook": 3,
      "persentase_semester": "12.5%"
    }
  ],
  "status": 200,
  "token": "none"
}
```

## Pembuatan Jadwal dan Logbook

### `POST /post/formadmin`

Role yang diizinkan: semua role, tetapi `labnya` harus termasuk lab miliknya. Admin boleh memilih semua lab.

Request body:

```json
{
  "labnya": 11,
  "prodinya": "TI 1A",
  "matkulnya": "Multimedia",
  "dosennya": "Nama Dosen",
  "tanggalnya": "2026-08-01",
  "jammulainya": "08:00",
  "jamselesainya": "10:00",
  "is_auto": true
}
```

Response sukses:

```json
{
  "message": {
    "insertId": 101,
    "affectedRows": 1
  },
  "status": 200,
  "token": "none"
}
```

### `POST /post/form` dan `POST /post/logbook`

Role yang diizinkan: semua role, tetapi ID jadwal (`schadule`, `schadules`, atau `Terjadwal`) harus berada pada lab yang dimiliki role tersebut.

Request body untuk `/post/logbook`:

```json
{
  "schadule": 101,
  "namaKetua": "Nama Mahasiswa",
  "nim": "12345678",
  "kelas": "TI 1A",
  "jumlahPeserta": 25,
  "nomorWa": "08123456789"
}
```

Response sukses:

```json
{
  "message": {
    "insertId": 20,
    "affectedRows": 1
  },
  "status": 200,
  "token": "none"
}
```

## Penghapusan Data

### `DELETE /delete/:id`

Menghapus satu jadwal. Role dapat menghapus hanya jadwal dari lab yang dimilikinya.

Contoh request:

```http
DELETE /delete/101
Authorization: Bearer <token-yusuf>
```

Response sukses:

```json
{
  "message": {
    "affectedRows": 1
  },
  "status": 200,
  "token": "none"
}
```

### `DELETE /delete/logbook/:id`

Menghapus satu logbook. Role dapat menghapus hanya logbook dari lab yang dimilikinya.

Response sukses:

```json
{
  "message": {
    "affectedRows": 1
  },
  "status": 200,
  "token": "none"
}
```

### `DELETE /delete/jadwal/clear` dan `DELETE /delete/logbook/clear`

Hanya role `admin` yang dapat menghapus seluruh jadwal atau seluruh logbook.

Response untuk role selain admin:

```json
{
  "pesan": "Hanya admin yang dapat mengakses endpoint ini"
}
```

Status: `403 Forbidden`.

## Pengelolaan Role

### `POST /post/regist`

Hanya admin yang dapat membuat user baru.

Request body:

```json
{
  "username": "ahmad",
  "password": "password-user",
  "role": "ahmad"
}
```

### `PATCH /update/user/:id/role`

Hanya admin yang dapat mengubah role user.

Request body:

```json
{
  "role": "ade"
}
```

Response sukses:

```json
{
  "message": {
    "id": 7,
    "username": "ade",
    "role": "ade"
  },
  "status": 200,
  "token": "none"
}
```

## Socket.IO

Socket.IO juga wajib JWT. Kirim token saat koneksi:

```js
io("http://172.20.32.91", {
  auth: {
    token: tokenLogin
  }
})
```

Event `penggunaanlab:update`, `logbook:update`, `history:schadule:update`, dan `history:logbook:update` hanya mengirim data lab sesuai role socket yang terhubung. Admin menerima seluruh data.
