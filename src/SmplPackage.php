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
}
