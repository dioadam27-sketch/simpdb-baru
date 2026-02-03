
<?php
// api.php - Backend for SIMPDB (Standardized JSON API)

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// =================================================================================
// KONFIGURASI DATABASE
// =================================================================================

$host = 'localhost';
$db_name = 'pkkiipendidikanu_simpdb';
$username = 'pkkiipendidikanu_dioarsip';
$password = '@Dioadam27';

// =================================================================================

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(["error" => "Connection failed: " . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// --- GET REQUEST (Read All Data) ---
if ($method === 'GET') {
    $response = [];
    $tables = ['courses', 'lecturers', 'rooms', 'classes', 'schedule', 'teaching_logs', 'settings'];

    foreach ($tables as $table) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM `$table`"); 
            $stmt->execute();
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Type Casting
            foreach($data as &$row) {
                 if (isset($row['credits'])) $row['credits'] = (int)$row['credits'];
                 if (isset($row['capacity'])) $row['capacity'] = (int)$row['capacity'];
                 if (isset($row['week'])) $row['week'] = (int)$row['week'];
            }
            $response[$table] = $data;
        } catch (Exception $e) {
            $response[$table] = []; 
        }
    }

    echo json_encode($response);
    exit;
}

// --- POST REQUEST (Write Data) ---
if ($method === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    if (!$input) {
        echo json_encode(["status" => "error", "message" => "Invalid JSON"]);
        exit;
    }

    $action = $input['action'] ?? '';
    $table = $input['table'] ?? '';
    $data = $input['data'] ?? [];
    $id = $input['id'] ?? ($data['id'] ?? '');

    // --- STANDARD CRUD ACTIONS ---
    $allowedTables = ['courses', 'lecturers', 'rooms', 'classes', 'schedule', 'teaching_logs', 'settings'];
    if (!in_array($table, $allowedTables)) {
        echo json_encode(["status" => "error", "message" => "Invalid table"]);
        exit;
    }

    try {
        if ($action === 'add') {
            $columns = array_keys($data);
            $escaped_cols = array_map(function($k) { return "`$k`"; }, $columns);
            $placeholders = array_map(function($k) { return ":$k"; }, $columns);
            
            if (isset($data['lecturerIds']) && is_array($data['lecturerIds'])) {
                $data['lecturerIds'] = json_encode($data['lecturerIds']);
            }

            $sql = "INSERT INTO `$table` (" . implode(", ", $escaped_cols) . ") VALUES (" . implode(", ", $placeholders) . ")";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($data);

        } elseif ($action === 'update') {
            if ($table === 'teaching_logs') {
                $check = $pdo->prepare("SELECT id FROM teaching_logs WHERE scheduleId=:sid AND lecturerId=:lid AND week=:wk");
                $check->execute([':sid'=>$data['scheduleId'], ':lid'=>$data['lecturerId'], ':wk'=>$data['week']]);
                if ($row = $check->fetch()) {
                    $id = $row['id']; 
                } else {
                    $columns = array_keys($data);
                    $escaped_cols = array_map(function($k) { return "`$k`"; }, $columns);
                    $placeholders = array_map(function($k) { return ":$k"; }, $columns);
                    $sql = "INSERT INTO `$table` (" . implode(", ", $escaped_cols) . ") VALUES (" . implode(", ", $placeholders) . ")";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($data);
                    echo json_encode(["status" => "success"]);
                    exit;
                }
            }

            if ($table === 'settings' && isset($data['key'])) {
                 $del = $pdo->prepare("DELETE FROM settings WHERE `key` = :k");
                 $del->execute([':k' => $data['key']]);
                 
                 $columns = array_keys($data);
                 $escaped_cols = array_map(function($k) { return "`$k`"; }, $columns);
                 $placeholders = array_map(function($k) { return ":$k"; }, $columns);
                 $sql = "INSERT INTO `$table` (" . implode(", ", $escaped_cols) . ") VALUES (" . implode(", ", $placeholders) . ")";
                 $stmt = $pdo->prepare($sql);
                 $stmt->execute($data);
            } else {
                if (!$id) throw new Exception("ID required for update");
                
                if (isset($data['lecturerIds']) && is_array($data['lecturerIds'])) {
                    $data['lecturerIds'] = json_encode($data['lecturerIds']);
                }

                $setPart = [];
                foreach ($data as $key => $value) {
                    $setPart[] = "`$key` = :$key"; 
                }
                $sql = "UPDATE `$table` SET " . implode(", ", $setPart) . " WHERE id = :id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($data);
            }

        } elseif ($action === 'delete') {
            if (!$id) throw new Exception("ID required for delete");
            $stmt = $pdo->prepare("DELETE FROM `$table` WHERE id = :id");
            $stmt->execute([':id' => $id]);

        } elseif ($action === 'bulk_add') {
            if (!is_array($data)) throw new Exception("Data must be array for bulk_add");
            foreach ($data as $row) {
                if (isset($row['lecturerIds']) && is_array($row['lecturerIds'])) {
                    $row['lecturerIds'] = json_encode($row['lecturerIds']);
                }
                $columns = array_keys($row);
                $escaped_cols = array_map(function($k) { return "`$k`"; }, $columns);
                $placeholders = array_map(function($k) { return ":$k"; }, $columns);
                $sql = "INSERT INTO `$table` (" . implode(", ", $escaped_cols) . ") VALUES (" . implode(", ", $placeholders) . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($row);
            }

        } elseif ($action === 'clear') {
            $stmt = $pdo->prepare("DELETE FROM `$table`");
            $stmt->execute();
        }

        echo json_encode(["status" => "success"]);

    } catch (Exception $e) {
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
?>
