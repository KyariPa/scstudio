'use strict';
// Bank soal psikotes: 12 Karakter Kebhayangkaraan x 5 soal situasional.
// Tiap opsi punya skor 1-4 (4 = sikap paling sesuai). Urutan opsi diacak saat tampil.

const DIMENSI = [
  { kode: 'BRA', nama: 'Beriman', makna: 'Beriman dan bertakwa kepada Tuhan Yang Maha Esa serta mematuhi perintah-Nya.' },
  { kode: 'TA', nama: 'Cinta Tanah Air', makna: 'Memiliki rasa sayang dan nasionalisme yang mendalam terhadap bangsa dan negara.' },
  { kode: 'DE', nama: 'Demokratis', makna: 'Menghargai aspirasi rakyat serta menjalankan tugas berdasarkan prinsip demokrasi.' },
  { kode: 'DI', nama: 'Disiplin', makna: 'Patuh dan taat terhadap segala aturan, norma, serta ketentuan yang berlaku.' },
  { kode: 'KA', nama: 'Kerja Keras & Cerdas', makna: 'Menyeimbangkan kemampuan akal, fisik, dan hati dalam setiap pelaksanaan tugas.' },
  { kode: 'SI', nama: 'Profesional', makna: 'Memiliki keahlian, kompetensi, dan tanggung jawab tinggi dalam bekerja.' },
  { kode: 'S', nama: 'Sederhana', makna: 'Hidup secara proporsional dan tidak berlebihan.' },
  { kode: 'E', nama: 'Empati', makna: 'Memiliki kepekaan afektif dan kognitif terhadap kondisi masyarakat.' },
  { kode: 'J', nama: 'Jujur dan Ikhlas', makna: 'Menjunjung tinggi kebenaran serta ketulusan dalam pengabdian.' },
  { kode: 'A', nama: 'Adil', makna: 'Bertindak objektif dan non-diskriminatif kepada semua pihak.' },
  { kode: 'T', nama: 'Teladan', makna: 'Menjadi panutan yang baik bagi lingkungan sekitar dan masyarakat.' },
  { kode: 'I', nama: 'Berintegritas', makna: 'Memiliki kapasitas moral yang kuat, konsisten, dan terpercaya.' },
];

const SOAL = [
  // BRA — Beriman
  { id: 'BRA1', d: 'BRA', q: 'Saat Anda bertugas pengamanan, waktu ibadah tiba sementara situasi di lapangan sedang ramai. Apa yang Anda lakukan?', o: [
    ['Berkoordinasi dengan rekan agar bergantian menjalankan ibadah tanpa meninggalkan pos kosong.', 4],
    ['Menunda ibadah sampai situasi aman, lalu menjalankannya setelah tugas selesai.', 3],
    ['Mengabaikan ibadah karena tugas lebih penting.', 2],
    ['Langsung meninggalkan pos untuk beribadah.', 1]] },
  { id: 'BRA2', d: 'BRA', q: 'Rekan satu regu yang berbeda agama meminta tukar jadwal piket karena hari rayanya, padahal hari itu Anda punya acara keluarga.', o: [
    ['Menyetujui, lalu mengatur waktu agar tetap bisa hadir sebagian di acara keluarga.', 4],
    ['Menyetujui dengan syarat ia menggantikan piket Anda di lain hari.', 3],
    ['Menolak karena jadwal sudah ditetapkan.', 2],
    ['Melapor ke atasan agar permintaan tukar jadwal itu tidak diizinkan.', 1]] },
  { id: 'BRA3', d: 'BRA', q: 'Anda mengalami masalah berat, misalnya gagal ujian kenaikan atau musibah keluarga. Bagaimana sikap Anda?', o: [
    ['Menerima dengan lapang dada, berdoa, lalu mengevaluasi diri dan mencoba lagi.', 4],
    ['Bercerita ke keluarga atau rekan dekat untuk meringankan beban.', 3],
    ['Diam dan memendamnya sendiri sampai reda.', 2],
    ['Menyalahkan keadaan dan orang lain.', 1]] },
  { id: 'BRA4', d: 'BRA', q: 'Anda melihat rekan bercanda mengejek keyakinan seorang warga yang sedang melapor.', o: [
    ['Menegur rekan secara sopan dan meminta maaf kepada warga.', 4],
    ['Melaporkannya ke atasan tanpa bicara ke rekan.', 3],
    ['Pura-pura tidak mendengar.', 2],
    ['Ikut tertawa agar suasana tidak canggung.', 1]] },
  { id: 'BRA5', d: 'BRA', q: 'Anda ditugaskan mengamankan perayaan hari besar agama yang bukan agama Anda.', o: [
    ['Melaksanakan tugas sepenuh hati seperti mengamankan kegiatan agama sendiri.', 4],
    ['Melaksanakan tugas sambil menjaga jarak dari kegiatan ibadahnya.', 3],
    ['Meminta diganti petugas yang seagama dengan jemaat.', 2],
    ['Melaksanakan tugas seadanya karena merasa bukan urusan Anda.', 1]] },

  // TA — Cinta Tanah Air
  { id: 'TA1', d: 'TA', q: 'Saat upacara bendera, cuaca sangat panas dan beberapa peserta mulai mengeluh.', o: [
    ['Tetap tertib, dan jika ada peserta yang lemas segera melapor ke petugas kesehatan.', 4],
    ['Tetap sikap sempurna sampai upacara selesai.', 3],
    ['Tetap ikut upacara sambil mengobrol pelan.', 2],
    ['Ikut mengeluh asal tidak terlihat atasan.', 1]] },
  { id: 'TA2', d: 'TA', q: 'Anda melihat unggahan media sosial yang menghina simbol negara dan sedang viral.', o: [
    ['Melaporkan konten itu lewat jalur resmi dan tidak ikut menyebarkannya.', 4],
    ['Menulis komentar yang menasihati pengunggah.', 3],
    ['Membiarkan saja karena bukan urusan Anda.', 2],
    ['Ikut membagikannya sambil memberi komentar marah.', 1]] },
  { id: 'TA3', d: 'TA', q: 'Anda ditempatkan di daerah terpencil yang jauh dari keluarga.', o: [
    ['Menerima, beradaptasi, dan mempelajari budaya setempat agar dekat dengan warga.', 4],
    ['Menerima dan menjalaninya sebagai bentuk pengabdian.', 3],
    ['Menerima sambil terus mengajukan pindah secepatnya.', 2],
    ['Menolak penempatan.', 1]] },
  { id: 'TA4', d: 'TA', q: 'Seorang wisatawan asing melanggar aturan dan merendahkan budaya setempat.', o: [
    ['Menindak sesuai aturan dengan sopan dan tegas, tanpa membedakan kewarganegaraan.', 4],
    ['Memberi peringatan lisan saja.', 3],
    ['Menegurnya dengan keras dan emosional.', 2],
    ['Membiarkannya karena takut menimbulkan masalah.', 1]] },
  { id: 'TA5', d: 'TA', q: 'Terjadi bencana alam di daerah lain dan satuan Anda membuka pendaftaran relawan.', o: [
    ['Mendaftar sebagai relawan atau membantu sesuai kemampuan.', 4],
    ['Menyumbang uang, tetapi tidak terlibat langsung.', 3],
    ['Tidak ikut karena bukan perintah wajib.', 2],
    ['Mengkritik penanganan bencana di media sosial.', 1]] },

  // DE — Demokratis
  { id: 'DE1', d: 'DE', q: 'Saat pengamanan unjuk rasa, massa berteriak keras tetapi masih damai.', o: [
    ['Tetap tenang, menjaga jarak aman, dan mengawal agar aspirasi tersampaikan dengan tertib.', 4],
    ['Mengajak perwakilan massa berdialog dengan pihak terkait.', 3],
    ['Membalas teriakan untuk menunjukkan wibawa.', 2],
    ['Membubarkan paksa sebelum terjadi kericuhan.', 1]] },
  { id: 'DE2', d: 'DE', q: 'Dalam rapat regu, pendapat Anda ditolak oleh mayoritas.', o: [
    ['Menerima keputusan dan melaksanakannya dengan sungguh-sungguh.', 4],
    ['Menerima, lalu menyampaikan catatan tertulis ke atasan sebagai bahan evaluasi.', 3],
    ['Menerima, tetapi melaksanakannya setengah hati.', 2],
    ['Terus memaksakan pendapat sampai rapat berlarut-larut.', 1]] },
  { id: 'DE3', d: 'DE', q: 'Warga datang mengeluhkan kinerja polisi di wilayahnya dengan nada kasar.', o: [
    ['Mendengarkan dengan sabar, mencatat, dan menindaklanjuti sesuai prosedur.', 4],
    ['Mendengarkan, lalu mengarahkannya ke bagian pengaduan.', 3],
    ['Meminta warga pulang dulu dan kembali saat lebih tenang.', 2],
    ['Membela institusi dan membantah semua keluhan.', 1]] },
  { id: 'DE4', d: 'DE', q: 'Menjelang pemilu, kerabat meminta Anda membantu kampanye calon tertentu.', o: [
    ['Menolak dan menjelaskan aturan netralitas anggota Polri kepada kerabat.', 4],
    ['Menolak dengan sopan.', 3],
    ['Tidak membantu kampanye, tetapi ikut menyarankan orang lain memilih calon itu.', 2],
    ['Membantu diam-diam tanpa memakai atribut.', 1]] },
  { id: 'DE5', d: 'DE', q: 'Dua kelompok warga berbeda pendapat soal pembangunan fasilitas umum dan mulai saling ancam.', o: [
    ['Memfasilitasi pertemuan kedua kelompok bersama tokoh masyarakat dan pemerintah setempat.', 4],
    ['Memberi imbauan agar kedua pihak menahan diri.', 3],
    ['Menunggu sampai ada laporan resmi.', 2],
    ['Memihak kelompok yang jumlahnya lebih besar.', 1]] },

  // DI — Disiplin
  { id: 'DI1', d: 'DI', q: 'Anda terlambat bangun dan dipastikan telat apel pagi.', o: [
    ['Segera berangkat, melapor jujur ke atasan, dan menerima sanksi.', 4],
    ['Datang secepatnya dan menjelaskan saat ditanya.', 3],
    ['Meminta rekan menutupi keterlambatan Anda.', 2],
    ['Membuat alasan sakit agar tidak dihukum.', 1]] },
  { id: 'DI2', d: 'DI', q: 'Atasan memberi perintah yang menurut Anda kurang efisien, tetapi tidak melanggar aturan.', o: [
    ['Melaksanakan perintah, lalu menyampaikan masukan pada waktu yang tepat.', 4],
    ['Melaksanakan sesuai perintah tanpa berkomentar.', 3],
    ['Melaksanakan dengan cara Anda sendiri karena lebih efisien.', 2],
    ['Menolak melaksanakan sampai atasan mengubahnya.', 1]] },
  { id: 'DI3', d: 'DI', q: 'Saat razia lalu lintas, pelanggar ternyata kenalan dekat Anda.', o: [
    ['Menindak sesuai prosedur seperti pelanggar lain.', 4],
    ['Meminta rekan lain yang menindaknya.', 3],
    ['Melepaskannya dengan teguran.', 2],
    ['Melepaskannya dan meminta ia tidak bercerita ke siapa pun.', 1]] },
  { id: 'DI4', d: 'DI', q: 'Saat piket malam yang sepi, rekan mengajak tidur bergantian tanpa izin.', o: [
    ['Menolak, tetap berjaga, dan mengusulkan pembagian istirahat yang resmi ke atasan.', 4],
    ['Menolak dan tetap berjaga sesuai jadwal.', 3],
    ['Setuju, tetapi Anda sendiri tetap terjaga.', 2],
    ['Setuju, asalkan tidak ketahuan.', 1]] },
  { id: 'DI5', d: 'DI', q: 'Ada aturan berseragam yang menurut Anda sudah kuno.', o: [
    ['Tetap mematuhi dan mengusulkan perubahan lewat jalur resmi.', 4],
    ['Mematuhinya tanpa mempersoalkan.', 3],
    ['Mematuhinya hanya saat ada atasan.', 2],
    ['Melanggar sedikit karena banyak yang melakukannya.', 1]] },

  // KA — Kerja Keras & Cerdas
  { id: 'KA1', d: 'KA', q: 'Anda diberi tugas laporan dengan tenggat besok, padahal datanya belum lengkap.', o: [
    ['Menyusun prioritas, mengumpulkan data yang bisa didapat, dan melapor ke atasan bagian mana yang belum lengkap.', 4],
    ['Meminta perpanjangan waktu.', 3],
    ['Menyerahkan apa adanya tanpa penjelasan.', 2],
    ['Lembur dan mengisi data yang kosong dengan perkiraan.', 1]] },
  { id: 'KA2', d: 'KA', q: 'Ada aplikasi pelaporan digital baru yang belum Anda kuasai.', o: [
    ['Mempelajarinya sendiri dan bertanya ke rekan yang paham.', 4],
    ['Menunggu pelatihan resmi.', 3],
    ['Tetap memakai cara lama selama masih bisa.', 2],
    ['Meminta rekan mengerjakan bagian Anda.', 1]] },
  { id: 'KA3', d: 'KA', q: 'Fisik Anda sedang lelah, tetapi tugas lapangan masih banyak.', o: [
    ['Mengatur ritme, beristirahat singkat saat ada kesempatan, lalu melanjutkan.', 4],
    ['Melapor ke atasan bahwa kondisi menurun dan meminta penyesuaian tugas.', 3],
    ['Memaksakan diri sampai tumbang.', 2],
    ['Pulang lebih awal tanpa izin.', 1]] },
  { id: 'KA4', d: 'KA', q: 'Kasus yang Anda tangani buntu selama berminggu-minggu.', o: [
    ['Meninjau ulang bukti, mencari sudut pandang baru, dan berdiskusi dengan tim.', 4],
    ['Meminta kasus dialihkan ke orang lain.', 3],
    ['Menunggu petunjuk baru datang sendiri.', 2],
    ['Menutup kasus karena terlalu lama.', 1]] },
  { id: 'KA5', d: 'KA', q: 'Saat menolong korban kecelakaan, warga panik dan berkerumun.', o: [
    ['Mengamankan lokasi, menenangkan warga, memberi pertolongan pertama, dan memanggil bantuan medis.', 4],
    ['Menghubungi ambulans lalu menunggu.', 3],
    ['Membubarkan kerumunan dengan bentakan.', 2],
    ['Langsung mengangkat korban ke kendaraan sendiri.', 1]] },

  // SI — Profesional
  { id: 'SI1', d: 'SI', q: 'Anda diminta menangani perkara di luar bidang keahlian Anda.', o: [
    ['Menerima, mempelajari prosedurnya, dan berkonsultasi dengan yang ahli.', 4],
    ['Menerima, tetapi meminta pendampingan.', 3],
    ['Menolak karena bukan bidang Anda.', 2],
    ['Menerima dan mengerjakan sebisanya tanpa bertanya.', 1]] },
  { id: 'SI2', d: 'SI', q: 'Anda melakukan kesalahan prosedur kecil yang belum diketahui siapa pun.', o: [
    ['Melapor, memperbaiki, dan memastikan tidak terulang.', 4],
    ['Memperbaikinya, lalu menceritakannya ke rekan sebagai pelajaran.', 3],
    ['Memperbaikinya diam-diam.', 2],
    ['Membiarkannya karena dampaknya kecil.', 1]] },
  { id: 'SI3', d: 'SI', q: 'Saat bertugas, Anda menerima telepon pribadi yang penting.', o: [
    ['Menjawab singkat setelah memastikan tugas aman, atau menelepon balik setelah tugas.', 4],
    ['Meminta rekan menggantikan sebentar, lalu menjawab telepon.', 3],
    ['Mengabaikannya sama sekali sampai shift selesai.', 2],
    ['Mengangkat dan mengobrol lama.', 1]] },
  { id: 'SI4', d: 'SI', q: 'Seorang pelapor memberi informasi yang menurut Anda dibesar-besarkan.', o: [
    ['Tetap mencatat secara objektif dan memverifikasi faktanya.', 4],
    ['Mencatat semuanya, lalu memberi tanda bagian yang meragukan.', 3],
    ['Mencatat hanya bagian yang Anda percayai.', 2],
    ['Mengabaikan laporannya.', 1]] },
  { id: 'SI5', d: 'SI', q: 'Wartawan meminta komentar Anda tentang kasus yang sedang ditangani.', o: [
    ['Mengarahkan ke humas sesuai prosedur, tanpa membocorkan detail.', 4],
    ['Memberi komentar umum tanpa detail.', 3],
    ['Menolak dengan ketus.', 2],
    ['Memberi sedikit bocoran agar wartawan puas.', 1]] },

  // S — Sederhana
  { id: 'S1', d: 'S', q: 'Gaji pertama Anda cair dan teman-teman mengajak pesta mewah.', o: [
    ['Menolak dengan sopan dan memakai gaji sesuai rencana kebutuhan.', 4],
    ['Ikut, tetapi membayar bagian sendiri secukupnya.', 3],
    ['Ikut dan mentraktir semua agar dihargai.', 2],
    ['Ikut dan berutang jika uangnya kurang.', 1]] },
  { id: 'S2', d: 'S', q: 'Anda ingin kendaraan baru seperti rekan-rekan, padahal keuangan pas-pasan.', o: [
    ['Menunda dan menabung sampai mampu.', 4],
    ['Membeli kendaraan bekas yang sesuai kemampuan.', 3],
    ['Mengambil kredit dengan cicilan yang sangat memberatkan.', 2],
    ['Meminjam uang dari pihak yang punya kepentingan dengan tugas Anda.', 1]] },
  { id: 'S3', d: 'S', q: 'Saat berseragam, Anda diajak berfoto memamerkan barang mewah untuk media sosial.', o: [
    ['Menolak dan mengingatkan rekan tentang etika bermedia sosial.', 4],
    ['Menolak karena tidak pantas memamerkan kemewahan dengan atribut dinas.', 3],
    ['Ikut berfoto, tetapi tidak mengunggahnya.', 2],
    ['Ikut, toh hanya untuk hiburan.', 1]] },
  { id: 'S4', d: 'S', q: 'Keluarga meminta Anda mengadakan pesta pernikahan besar-besaran di luar kemampuan.', o: [
    ['Berdiskusi dengan keluarga untuk menyelenggarakan acara sesuai kemampuan.', 4],
    ['Menuruti sebagian dan meminta bantuan keluarga.', 3],
    ['Menolak tanpa diskusi.', 2],
    ['Menuruti dengan berutang.', 1]] },
  { id: 'S5', d: 'S', q: 'Rekan Anda sering pamer gaya hidup mewah yang tidak sesuai penghasilannya.', o: [
    ['Mengingatkannya secara pribadi, dan bila ada indikasi pelanggaran, melapor sesuai jalur.', 4],
    ['Diam saja karena itu urusan pribadinya.', 2],
    ['Membicarakannya dengan rekan-rekan lain.', 1],
    ['Ikut bergaya agar tidak kalah.', 1]] },

  // E — Empati
  { id: 'E1', d: 'E', q: 'Seorang ibu datang melapor kehilangan sambil menangis dan sulit bercerita runtut.', o: [
    ['Menenangkannya, memberi waktu, lalu menggali informasi pelan-pelan.', 4],
    ['Meminta keluarganya yang bercerita.', 3],
    ['Meminta ia kembali saat sudah tenang.', 2],
    ['Mendesaknya agar cepat bercerita karena antrean panjang.', 1]] },
  { id: 'E2', d: 'E', q: 'Saat razia, seorang pengendara tidak membawa SIM karena buru-buru mengantar anaknya yang sakit ke rumah sakit.', o: [
    ['Memastikan kondisi anak, membantu akses ke rumah sakit, lalu menyelesaikan pelanggaran sesuai prosedur.', 4],
    ['Membiarkannya pergi tanpa catatan apa pun.', 3],
    ['Langsung menilang tanpa mendengarkan.', 2],
    ['Menahan kendaraan sampai SIM dibawa.', 1]] },
  { id: 'E3', d: 'E', q: 'Ada warga lansia kebingungan di tengah jalan yang ramai.', o: [
    ['Membantunya menyeberang dan memastikan ia sampai ke tujuan atau keluarganya.', 4],
    ['Meminta warga lain membantunya.', 3],
    ['Menunjukkan arah, lalu melanjutkan tugas.', 2],
    ['Mengabaikannya karena sedang sibuk.', 1]] },
  { id: 'E4', d: 'E', q: 'Rekan Anda terlihat murung beberapa hari dan kinerjanya menurun.', o: [
    ['Mengajaknya bicara secara pribadi dan menawarkan bantuan.', 4],
    ['Menyarankannya menemui konselor atau layanan psikologi satuan.', 3],
    ['Melapor ke atasan bahwa kinerjanya menurun.', 2],
    ['Membiarkannya, nanti juga membaik sendiri.', 1]] },
  { id: 'E5', d: 'E', q: 'Pelaku pencurian ternyata remaja yang mencuri makanan karena kelaparan.', o: [
    ['Memproses sesuai hukum sambil mempertimbangkan pendekatan restoratif dan menghubungkannya ke dinas sosial.', 4],
    ['Menyerahkannya ke orang tua dengan teguran.', 3],
    ['Melepaskannya begitu saja.', 2],
    ['Memprosesnya dengan keras agar jera.', 1]] },

  // J — Jujur dan Ikhlas
  { id: 'J1', d: 'J', q: 'Pengendara yang Anda tilang menyelipkan uang agar urusan selesai di tempat.', o: [
    ['Menolak tegas, menjelaskan prosedur resmi, dan mencatat upaya suap sesuai aturan.', 4],
    ['Menolak dan tetap menilang.', 3],
    ['Menolak, tetapi membiarkannya pergi tanpa tilang.', 2],
    ['Menerima karena jumlahnya kecil.', 1]] },
  { id: 'J2', d: 'J', q: 'Anda menemukan dompet berisi banyak uang saat patroli.', o: [
    ['Mencatat, mengamankan, dan mengembalikannya ke pemilik lewat prosedur barang temuan.', 4],
    ['Mengumumkannya di media sosial agar pemiliknya menghubungi.', 3],
    ['Menyerahkannya ke rekan agar dia yang mengurus.', 2],
    ['Mengambil sebagian sebagai "upah" penemu.', 1]] },
  { id: 'J3', d: 'J', q: 'Atasan memuji hasil kerja yang sebagian besar dikerjakan rekan Anda.', o: [
    ['Menyampaikan bahwa rekan Anda yang berperan besar.', 4],
    ['Menyebut bahwa itu hasil kerja tim.', 3],
    ['Berterima kasih, lalu nanti memberi tahu rekan bahwa atasan senang.', 2],
    ['Diam dan menerima pujian.', 1]] },
  { id: 'J4', d: 'J', q: 'Anda diminta membantu kegiatan sosial di luar jam dinas tanpa imbalan.', o: [
    ['Membantu dengan sukarela sesuai kemampuan.', 4],
    ['Menolak dengan sopan karena ada keperluan lain.', 3],
    ['Membantu jika ada uang lelah.', 2],
    ['Ikut hanya untuk difoto dan diunggah.', 1]] },
  { id: 'J5', d: 'J', q: 'Selama seleksi, ada orang yang menawarkan "jalur khusus" berbayar agar Anda lolos.', o: [
    ['Menolak dan melaporkannya ke panitia atau saluran pengaduan resmi.', 4],
    ['Menolak, tetapi tidak melapor.', 3],
    ['Menanyakan harganya dulu.', 2],
    ['Mempertimbangkannya karena banyak yang memakai.', 1]] },

  // A — Adil
  { id: 'A1', d: 'A', q: 'Dua orang berkelahi, dan salah satunya anak pejabat setempat.', o: [
    ['Memproses keduanya secara sama sesuai fakta dan bukti.', 4],
    ['Memproses, tetapi meminta atasan yang memutuskan karena ada tekanan.', 3],
    ['Mendamaikan di tempat tanpa mencatat.', 2],
    ['Mendahulukan kepentingan anak pejabat.', 1]] },
  { id: 'A2', d: 'A', q: 'Warga dari kelompok minoritas melapor, dan Anda mendengar warga lain berkomentar merendahkan.', o: [
    ['Melayani laporannya setara dengan warga lain dan menegur komentar diskriminatif itu.', 4],
    ['Melayaninya, tetapi mengabaikan komentar itu.', 3],
    ['Meminta pelapor datang lain waktu.', 2],
    ['Mendahulukan pelapor lain agar suasana tenang.', 1]] },
  { id: 'A3', d: 'A', q: 'Anda harus menilai kinerja dua anggota, salah satunya teman dekat Anda.', o: [
    ['Menilai berdasarkan data kinerja yang terukur.', 4],
    ['Meminta orang lain ikut menilai untuk menghindari konflik kepentingan.', 3],
    ['Memberi nilai sama agar tidak ada yang kecewa.', 2],
    ['Memberi nilai lebih tinggi kepada teman.', 1]] },
  { id: 'A4', d: 'A', q: 'Saat penertiban pedagang kaki lima, ada pedagang yang biasa memberi Anda makanan gratis.', o: [
    ['Menertibkan semua pedagang secara sama, dan menolak pemberian gratis ke depannya.', 4],
    ['Menertibkan semua pedagang secara sama.', 3],
    ['Memberi tahu pedagang itu lebih dulu agar siap-siap.', 2],
    ['Membiarkan pedagang itu tetap berjualan.', 1]] },
  { id: 'A5', d: 'A', q: 'Dalam satu kasus, bukti mengarah ke orang yang Anda kenal baik dan Anda yakini orang baik.', o: [
    ['Tetap mengikuti bukti dan, bila perlu, mundur dari penanganan kasus karena konflik kepentingan.', 4],
    ['Mengikuti bukti apa adanya.', 3],
    ['Melanjutkan tanpa memberi tahu siapa pun bahwa Anda mengenalnya.', 2],
    ['Mencari bukti lain yang meringankan dia saja.', 1]] },

  // T — Teladan
  { id: 'T1', d: 'T', q: 'Di luar jam dinas, Anda berhenti di lampu merah yang sepi tanpa ada orang lain.', o: [
    ['Tetap berhenti sampai lampu hijau.', 4],
    ['Berhenti, kecuali sedang sangat terburu-buru.', 3],
    ['Menerobos pelan-pelan dengan hati-hati.', 2],
    ['Menerobos karena tidak ada yang melihat.', 1]] },
  { id: 'T2', d: 'T', q: 'Anak-anak di lingkungan rumah Anda suka meniru gaya Anda sebagai polisi.', o: [
    ['Memakai kesempatan itu untuk mengajarkan aturan lalu lintas dan keselamatan.', 4],
    ['Menjaga sikap dan tutur kata agar memberi contoh baik.', 3],
    ['Senang dan membiarkannya saja.', 2],
    ['Menyuruh mereka tidak meniru karena merepotkan.', 1]] },
  { id: 'T3', d: 'T', q: 'Saat makan di warung, rekan menolak membayar karena "polisi biasanya gratis".', o: [
    ['Membayar untuk diri sendiri dan mengingatkan rekan untuk membayar.', 4],
    ['Membayar untuk berdua diam-diam agar tidak ribut.', 3],
    ['Membayar sendiri tanpa mengomentari rekan.', 2],
    ['Ikut tidak membayar.', 1]] },
  { id: 'T4', d: 'T', q: 'Anda diundang menjadi pemateri sosialisasi di sebuah sekolah.', o: [
    ['Menyiapkan materi dengan baik serta tampil sopan dan tepat waktu.', 4],
    ['Datang dan menyampaikan materi umum tanpa persiapan khusus.', 3],
    ['Mengirim rekan lain untuk menggantikan.', 2],
    ['Datang seadanya karena hanya acara sekolah.', 1]] },
  { id: 'T5', d: 'T', q: 'Anda membuat kesalahan di depan anggota junior.', o: [
    ['Mengakui kesalahan dan memperbaikinya di depan mereka.', 4],
    ['Memperbaikinya tanpa berkomentar.', 3],
    ['Mengalihkan pembicaraan.', 2],
    ['Menyalahkan keadaan.', 1]] },

  // I — Berintegritas
  { id: 'I1', d: 'I', q: 'Atasan meminta Anda mengubah isi laporan agar hasilnya terlihat lebih baik.', o: [
    ['Menolak dengan sopan dan menjelaskan bahwa laporan harus sesuai fakta.', 4],
    ['Meminta perintah itu secara tertulis sebelum mengubah apa pun.', 3],
    ['Mengubahnya sedikit saja.', 2],
    ['Menurutinya karena itu perintah atasan.', 1]] },
  { id: 'I2', d: 'I', q: 'Anda tahu rekan sering memakai kendaraan dinas untuk keperluan pribadi.', o: [
    ['Mengingatkannya, dan jika berlanjut, melapor sesuai jalur.', 4],
    ['Melapor langsung tanpa mengingatkannya.', 3],
    ['Diam agar hubungan tetap baik.', 2],
    ['Ikut memakai karena sudah biasa.', 1]] },
  { id: 'I3', d: 'I', q: 'Tidak ada yang mengawasi saat Anda mengisi daftar hadir kegiatan yang tidak Anda ikuti penuh.', o: [
    ['Mengisi sesuai waktu kehadiran sebenarnya.', 4],
    ['Tidak mengisi sama sekali.', 3],
    ['Mengisi penuh, tetapi berniat menggantinya nanti.', 2],
    ['Mengisi penuh karena semua orang begitu.', 1]] },
  { id: 'I4', d: 'I', q: 'Anda dijanjikan promosi jika mau "mengamankan" sebuah kasus.', o: [
    ['Menolak dan melaporkan tawaran tersebut.', 4],
    ['Menolak tanpa melapor.', 3],
    ['Menunda jawaban sambil mempertimbangkannya.', 2],
    ['Menerima karena kesempatan seperti itu langka.', 1]] },
  { id: 'I5', d: 'I', q: 'Anda berjanji kepada warga akan menindaklanjuti laporannya, lalu pekerjaan menumpuk.', o: [
    ['Tetap menindaklanjuti dan memberi kabar perkembangan kepada warga.', 4],
    ['Menindaklanjuti saat sempat, tanpa memberi kabar.', 3],
    ['Menyerahkannya ke rekan tanpa memberi tahu warga.', 2],
    ['Melupakannya karena ada yang lebih penting.', 1]] },
];
