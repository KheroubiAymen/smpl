<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\Artisan;

class SmplPackage extends PackageInstaller
{
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
        $this->autoSync();
    }

    private function autoSync(): void
    {
        // Re-sync plugin content in DB whenever the JS file changes.
        // Uses DiData's own artisan command — no direct SQL.
        $hash     = md5_file(__DIR__.'/../resources/script.js');
        $flagFile = storage_path('app/smpl_synced_'.$hash);

        if (file_exists($flagFile)) {
            return;
        }

        try {
            Artisan::call('marketplace:sync-contributions');
            touch($flagFile);
        } catch (\Throwable $e) {
            // Command not available yet (fresh install, migrations pending) — retry next request.
        }
    }
}
