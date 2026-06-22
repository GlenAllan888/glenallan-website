<?php

function handle_browse(array $cfg, array $license): never {
    $path = ($_GET['path'] ?? '') ?: $_SERVER['DOCUMENT_ROOT'];

    $real = realpath($path);
    if ($real === false || !is_dir($real)) {
        json_response([
            'current'      => $path,
            'display_path' => folder_display_path($path),
            'parent'       => dirname($path),
            'dirs'         => [],
            'error'        => 'Directory not found or not readable.',
        ]);
    }

    $parent = ($real === '/') ? null : dirname($real);
    $dirs = [];

    $entries = @scandir($real);
    if ($entries !== false) {
        foreach ($entries as $entry) {
            if ($entry[0] === '.') continue;
            if (is_dir($real . '/' . $entry)) {
                $dirs[] = $entry;
            }
        }
        natcasesort($dirs);
        $dirs = array_values($dirs);
    }

    json_response([
        'current'      => $real,
        'display_path' => folder_display_path($real),
        'parent'       => $parent,
        'dirs'         => $dirs,
        'error'        => null,
    ]);
}
