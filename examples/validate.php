<?php
// Validate one file with PHP curl. PHP 8+ with the curl extension. Uses one free API call.
//   php examples/validate.php samples/valid-pain001-001-03.xml

if ($argc !== 2) {
    fwrite(STDERR, "usage: php validate.php FILE\n");
    exit(2);
}

$path = $argv[1];
$file = new CURLFile($path, "application/xml", basename($path));

$ch = curl_init("https://checksepa.com/v1/validate");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ["file" => $file],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 120,
]);
$body = curl_exec($ch);
if ($body === false) {
    fwrite(STDERR, curl_error($ch) . "\n");
    exit(2);
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo $body, "\n";
if ($status !== 200) {
    exit(1);
}
$report = json_decode($body, true);
exit(!empty($report["valid"]) ? 0 : 1);
