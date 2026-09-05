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
            ->hasMigrations()
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

    // Bump this constant whenever a new release ships changed JS/template files.
    // It forces a fresh flag-file name so any stale flag from the previous release is ignored.
    private const SYNC_VERSION = '2.3.1';

    public function afterBoot(): void
    {
        $this->autoSync();
    }

    private function autoSync(): void
    {
        $hash     = self::SYNC_VERSION.'_'.md5_file(__DIR__.'/../resources/script.js');
        $flagFile = storage_path('app/smpl_synced_'.$hash);

        if (file_exists($flagFile)) {
            return;
        }

        // Defer until ALL providers (including app providers) have booted.
        // Package providers boot before app providers, so calling Artisan here
        // directly would fail because marketplace services are not yet bound.
        app()->booted(function () use ($flagFile) {
            try {
                Artisan::call('marketplace:sync-contributions');
                touch($flagFile);
            } catch (\Throwable $e) {
                // Retry on the next request — do not create the flag file.
            }
        });
    }
}
