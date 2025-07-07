<?php
session_start();
header('Access-Control-Allow-Origin: https://alikhan.studio');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');


// Only allow DELETE requests
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

// Retrieve the 'file' parameter from the query string
$fileName = isset($_GET['file']) ? basename($_GET['file']) : null;

if (!$fileName) {
    http_response_code(400);
    echo json_encode(["error" => "Missing file parameter"]);
    exit;
}

// Define the storage directory
$storageDir = '/var/www/html/api/storage'; // Change this to your storage folder path
$filePath = realpath($storageDir . DIRECTORY_SEPARATOR . $fileName);

// Check if file exists and is inside the storage directory
if (!$filePath || strpos($filePath, realpath($storageDir)) !== 0 || !file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(["error" => "File not found"]);
    exit;
}

// Attempt to delete the file
if (unlink($filePath)) {
    echo json_encode(["message" => "File deleted successfully"]);
} else {
    http_response_code(500);
    echo json_encode(["error" => "Failed to delete file"]);
}
?>

