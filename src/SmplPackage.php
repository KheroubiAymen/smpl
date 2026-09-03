<?php

namespace SwissDidata\Smpl;

use App\Models\File as DidataFile;
use App\Models\Folder;
use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class SmplPackage extends PackageInstaller
{
    private const RESOURCES_FOLDER = 'smpl_resources';

    private const RESOURCE_FILES = [
        'd3.min.js', 'batch.svg', 'person.svg',
        'branches_hide.png', 'branches_show.png',
        'SMPL_logo_2.png', 'LOGO_SBP.svg',
    ];

    private static bool $resourcesChecked = false;

    public function configure(Package $package): void
    {
        $package->hasNoConfigFile()
            ->hasNoRoutes()
            ->hasNoTranslations()
            ->hasModulePlugin([
                'name'      => 'SMPL',
                'meta_data' => ['module_name' => 'smpl'],
                'icon'      => ['code' => 'biotech', 'color' => '#0072CE'],
                'template'  => __DIR__.'/../resources/template.xml',
                'js'        => __DIR__.'/../resources/script.js',
            ])
            ->hasModulePlugin([
                'name'      => 'SMPL Config',
                'meta_data' => ['module_name' => 'smpl_config'],
                'icon'      => ['code' => 'settings', 'color' => '#0072CE'],
                'template'  => __DIR__.'/../resources/config-template.xml',
                'js'        => __DIR__.'/../resources/config-script.js',
            ]);
    }

    public function afterBoot(): void
    {
        $this->publishPublicAssets();
        $this->ensureSmplResourcesFolder();
    }

    private function publishPublicAssets(): void
    {
        $target = public_path('vendor/smpl');
        if (! is_dir($target)) {
            File::copyDirectory(__DIR__.'/../resources/public', $target);
        }
    }

    private function ensureSmplResourcesFolder(): void
    {
        if (self::$resourcesChecked) {
            return;
        }
        self::$resourcesChecked = true;

        try {
            $folder = Folder::where('name', self::RESOURCES_FOLDER)->first();

            if (! $folder) {
                $folder = Folder::create([
                    'name'        => self::RESOURCES_FOLDER,
                    'description' => 'SMPL plugin resources (auto-created)',
                ]);
                $this->uploadResourcesToFolder($folder);
            }
        } catch (\Throwable $e) {
            // DB not ready (first migration run etc.) — retry next request
            self::$resourcesChecked = false;
        }
    }

    private function uploadResourcesToFolder(Folder $folder): void
    {
        $srcDir  = __DIR__.'/../resources/public';
        $disk    = Storage::disk('user-storage');

        $disk->makeDirectory(self::RESOURCES_FOLDER);

        foreach (self::RESOURCE_FILES as $filename) {
            $srcPath = $srcDir.'/'.$filename;
            if (! file_exists($srcPath)) {
                continue;
            }

            if (DidataFile::where('folder_id', $folder->id)->where('name', $filename)->exists()) {
                continue;
            }

            $disk->put(self::RESOURCES_FOLDER.'/'.$filename, file_get_contents($srcPath));

            DidataFile::create([
                'name'        => $filename,
                'path'        => self::RESOURCES_FOLDER,
                'size'        => round(filesize($srcPath) / 1024, 2),
                'folder_id'   => $folder->id,
                'description' => '',
                'checksum'    => hash_file('sha256', $srcPath),
            ]);
        }
    }
}
