<?php
// FILE INI SUDAH DIPINDAHKAN
// Logika API sekarang berada di folder /backend/api.php
// File ini disisakan sebagai redirect untuk kompatibilitas backward (cache lama)

header("HTTP/1.1 301 Moved Permanently");
header("Location: backend/api.php");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
exit();
?>