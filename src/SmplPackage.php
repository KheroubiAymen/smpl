<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class SmplPackage extends PackageInstaller
{
    public function configure(Package $package): void
    {
        $package
            ->hasMigrations()
            ->hasNoConfigFile()
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
        try {
            Artisan::call('marketplace:sync-contributions');
        } catch (\Throwable $e) {
            Log::error('[SMPL] marketplace:sync-contributions failed: ' . $e->getMessage());
        }
    }
}
