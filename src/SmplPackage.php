<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;

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
            ]);
    }

    public function afterBoot(): void
    {
        try {
            \App\Models\Plugin::where('name', 'SMPL')
                ->where('state', 'test')
                ->update(['state' => 'production', 'is_enable' => true]);
        } catch (\Throwable) {
            // table may not exist during migrations
        }
    }
}
