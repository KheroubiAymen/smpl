<?php

namespace SwissDidata\Smpl;

use Didata\Packages\installer\Package;
use Didata\Packages\installer\PackageInstaller;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class SmplPackage extends PackageInstaller
{
    public function configure(Package $package): void
    {
        $package->hasNoConfigFile()
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

    private const SYNC_VERSION = '2.3.10';

    public function afterBoot(): void
    {
        $this->autoSync();
    }

    private function autoSync(): void
    {
        $v          = self::SYNC_VERSION;
        $scriptHash = md5_file(__DIR__.'/../resources/script.js');
        $schemaFlag = storage_path("app/smpl_schema_{$v}");
        $routeFlag  = storage_path("app/smpl_routes_{$v}_{$scriptHash}");

        if (file_exists($schemaFlag) && file_exists($routeFlag)) {
            return;
        }

        app()->booted(function () use ($schemaFlag, $routeFlag) {
            if (!file_exists($schemaFlag)) {
                try {
                    $created = (new SmplSchemaSeeder())->seed();
                    // Verify the key entity type exists before marking schema as done
                    $schemaReady = DB::table('EntityType')->where('name', 'SMPL_STUDY')->exists();
                    if ($schemaReady) {
                        touch($schemaFlag);
                        Log::info('[SMPL] Entity schema seeded successfully ('.$created.' items created)');
                    } else {
                        Log::error('[SMPL] Entity schema incomplete — SMPL_STUDY not found, will retry on next boot');
                    }
                } catch (\Throwable $e) {
                    Log::error('[SMPL] seedEntitySchema failed: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                }
            }

            if (!file_exists($routeFlag)) {
                $routesOk = false;
                try {
                    $this->seedUserRoutes();
                    $routesOk = true;
                } catch (\Throwable $e) {
                    Log::error('[SMPL] seedUserRoutes failed: '.$e->getMessage().' in '.$e->getFile().':'.$e->getLine());
                }

                try {
                    $this->seedCalculations();
                } catch (\Throwable $e) {
                    Log::warning('[SMPL] seedCalculations skipped (non-critical): '.$e->getMessage());
                }

                try {
                    Artisan::call('marketplace:sync-contributions');
                } catch (\Throwable $e) {
                    Log::error('[SMPL] marketplace:sync-contributions failed: '.$e->getMessage());
                }

                if ($routesOk) {
                    touch($routeFlag);
                    Log::info('[SMPL] Routes and contributions synced');
                }
            }
        });
    }

    // ─── Calculations ────────────────────────────────────────────────────────

    private function seedCalculations(): void
    {
        $table = 'calculations_task';
        $cols  = Schema::getColumnListing($table);
        $now   = now();

        foreach ($this->calculationDefinitions() as $calc) {
            try {
                if (DB::table($table)->where('name', $calc['name'])->exists()) {
                    continue;
                }
                $row = ['name' => $calc['name']];
                if (in_array('php_script', $cols))         $row['php_script']         = $calc['script'];
                if (in_array('resource_type', $cols))      $row['resource_type']      = 'entity';
                if (in_array('execution_stage', $cols))    $row['execution_stage']    = $calc['stage'];
                if (in_array('active', $cols))             $row['active']             = 0;
                if (in_array('settings_form_id', $cols))   $row['settings_form_id']   = null;
                if (in_array('created_at', $cols))         $row['created_at']         = $now;
                if (in_array('updated_at', $cols))         $row['updated_at']         = $now;
                DB::table($table)->insert($row);
                Log::info('[SMPL] Created calculation: '.$calc['name']);
            } catch (\Throwable $e) {
                Log::warning('[SMPL] Could not create calculation '.$calc['name'].': '.$e->getMessage());
            }
        }
    }

    // ─── User Routes ─────────────────────────────────────────────────────────

    private function seedUserRoutes(): void
    {
        $table = 'user_route';
        $cols  = Schema::getColumnListing($table);
        $now   = now();

        foreach ($this->routeDefinitions() as $route) {
            $existing = DB::table($table)->where('name', $route['name'])->first();

            if ($existing) {
                DB::table($table)->where('name', $route['name'])->update([
                    'code'       => $route['code'],
                    'is_enabled' => 1,
                    'updated_at' => $now,
                ]);
                Log::info('[SMPL] Updated user route: '.$route['name']);
            } else {
                $row = [
                    'name'       => $route['name'],
                    'type'       => $route['type'],
                    'code'       => $route['code'],
                    'is_enabled' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                if (in_array('is_public', $cols))                   $row['is_public']                   = 0;
                if (in_array('sub_path', $cols))                    $row['sub_path']                    = $route['name'];
                if (in_array('allow_all_users_access_list', $cols)) $row['allow_all_users_access_list'] = 1;
                DB::table($table)->insert($row);
                Log::info('[SMPL] Created user route: '.$route['name']);
            }
        }
    }

    // ─── Data ────────────────────────────────────────────────────────────────

    private function calculationDefinitions(): array
    {
        return [
            [
                'name'   => 'smplPropagateIds',
                'stage'  => 'before',
                'script' => <<<'PHP'
$this->error = false;
if (isset($this->data['smpl_id'])) {
    $this->data['smpl_sample_id']  = $this->data['smpl_id'];
    $this->data['smpl_kit_id']     = $this->data['smpl_id'];
    $this->data['smpl_case_id']    = $this->data['smpl_id'];
    $this->data['smpl_subject_id'] = $this->data['smpl_id'];
}
PHP,
            ],
            [
                'name'   => 'smplKitStatusInference',
                'stage'  => 'before',
                'script' => <<<'PHP'
$sample = $this->getCurrentMode() === 'create' ? $this->data : $this->data + $this->getOldData();
if (isset($this->data['smpl_sample_status_fk']) && isset($sample['smpl_kit_fk'])) {
    $kit              = eqb()->entityType('SMPL_KIT')->where('id', '=', $sample['smpl_kit_fk'])->get()[0];
    $samples          = eqb()->entityType('SMPL_SAMPLE')->where('smpl_kit_fk', '=', $sample['smpl_kit_fk'])->get();
    $statuses         = eqb()->entityType('SMPL_STATUS')->get();
    $statusIdToSeq    = array_column($statuses, 'smpl_status_seq_number', 'id');
    $kitStatuses      = eqb()->entityType('SMPL_KIT_STATUS')->get();
    $kitSeqToId       = array_column($kitStatuses, 'id', 'smpl_seq_num');
    $seqs = [];
    foreach ($samples as $s) {
        $sid = $s['smpl_sample_status_fk'] ?? null;
        $seqs[] = isset($statusIdToSeq[$sid]) ? $statusIdToSeq[$sid] : null;
    }
    if (empty($seqs)) return null;
    $uniqueVals = array_unique($seqs); sort($uniqueVals);
    $min = min($seqs); $max = max($seqs);
    if (count($uniqueVals)===1 && $uniqueVals[0]===3)                         { $this->data['smpl_id_nb']=5; $kit['smpl_kit_status']=$kitSeqToId[5]; }
    elseif ($max<=3 && in_array(3,$seqs,true))                                { $this->data['smpl_id_nb']=4; $kit['smpl_kit_status']=$kitSeqToId[4]; }
    elseif (count($uniqueVals)===1 && $uniqueVals[0]===2)                     { $this->data['smpl_id_nb']=3; $kit['smpl_kit_status']=$kitSeqToId[3]; }
    elseif ($max<=2 && in_array(2,$seqs,true))                                { $this->data['smpl_id_nb']=2; $kit['smpl_kit_status']=$kitSeqToId[2]; }
    elseif ($max<=1 && in_array(1,$seqs,true))                                { $this->data['smpl_id_nb']=1; $kit['smpl_kit_status']=$kitSeqToId[1]; }
    elseif ($max<=0 && in_array(0,$seqs,true))                                { $this->data['smpl_id_nb']=0; $kit['smpl_kit_status']=$kitSeqToId[0]; }
    elseif (count($uniqueVals)===1 && $uniqueVals[0]===-1)                    { $this->data['smpl_id_nb']=-1;$kit['smpl_kit_status']=$kitSeqToId[-1]; }
    elseif ($max<0)                                                            { $this->data['smpl_id_nb']=-2;$kit['smpl_kit_status']=$kitSeqToId[-2]; }
}
PHP,
            ],
            [
                'name'   => 'smplEventPropagation',
                'stage'  => 'after',
                'script' => <<<'PHP'
use Didata\Entities\Repositories\Models\EntityType;
use Didata\Entities\Repositories\Models\Entity;
$event = $this->getCurrentMode()=='create' ? $this->data : array_merge($this->getOldData(),$this->data);
$type  = EntityType::find($event['entitytype_id'])?->name;
$firstField=null; $lastField=null;
if ($type=='SMPL_RECEPTION')       { $firstField='smpl_first_reception';      $lastField='smpl_last_reception'; }
elseif ($type=='SMPL_TRANSPORTATION') { $firstField='smpl_first_transportation'; $lastField='smpl_last_transportation'; }
elseif ($type=='SMPL_STORAGE')     { $firstField='smpl_first_storage';        $lastField='smpl_last_storage'; }
elseif ($type=='SMPL_CENTRIFUGATION') { $firstField='smpl_first_centrifugation'; $lastField='smpl_last_centrifugation'; }
elseif ($type=='SMPL_ANALYSIS')    { $firstField='smpl_first_analysis';       $lastField='smpl_last_analysis'; }
elseif ($type=='SMPL_PROCESSING')  { $firstField='smpl_first_processing';     $lastField='smpl_last_processing'; }
if ($firstField!==null) {
    $samples=$event['smpl_samples_fk'];
    foreach ($samples as $sample) {
        $events=eqb()->entityType($type)->where('smpl_samples_fk','contain',$sample)->orderby('smpl_event_start_time','asc')->get();
        $firstEvent=$events[0]??null; $lastEvent=$events[count($events)-1]??null;
        dac()->update('entity',Entity::find($sample),[$firstField=>$firstEvent?$firstEvent['id']:null,$lastField=>$lastEvent?$lastEvent['id']:null]);
    }
}
PHP,
            ],
        ];
    }

    private function routeDefinitions(): array
    {
        return [
            [
                'name' => 'smpl_get_all_workflows',
                'type' => 'GET',
                'code' => <<<'PHP'
$project_id = $this->request->projectId;
$workflows = eqb()->project($project_id)->entityType('SMPL_WORKFLOW')->get();
foreach ($workflows as &$workflow) {
    $study = eqb()->project($project_id)->entityType('SMPL_STUDY')->where('id','=',$workflow['smpl_study_fk'])->get();
    $workflow['study'] = $study[0]['smpl_label'] ?? null;
}
unset($workflow);
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode($workflows));
PHP,
            ],
            [
                'name' => 'smpl_load_workflow',
                'type' => 'GET',
                'code' => <<<'PHP'
function smplSortByOrder($a,$b){return $a['smpl_order']<=>$b['smpl_order'];}
function smplChildLines($parentId,$project_id){
    $ch=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('smpl_workflow_line_fk','=',$parentId)->get();
    foreach($ch as $c){$ch=array_merge($ch,smplChildLines($c['id'],$project_id));}
    return $ch;
}
$project_id=$this->request->projectId; $wfid=$this->request->workflowId; $ctid=$this->request->caseTypeId;
$workflow=eqb()->project($project_id)->entityType('SMPL_WORKFLOW')->where('id','=',$wfid)->get()[0];
$study=eqb()->project($project_id)->entityType('SMPL_STUDY')->where('id','=',$workflow['smpl_study_fk'])->get();
$lines=[];
if($ctid){
    $lineIds=eqb()->project($project_id)->entityType('SMPL_CASE_TYPE')->where('id','=',$ctid)->get()[0]['smpl_workflow_lines_fk'];
    foreach($lineIds as $lid){$lines[]=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('id','=',$lid)->get()[0];$lines=array_merge($lines,smplChildLines($lid,$project_id));}
}else{$lines=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('smpl_workflow_fk','=',$wfid)->get();}
usort($lines,'smplSortByOrder');
$workflow['lines']=$lines; $workflow['study']=$study[0]['smpl_label']??null;
$workflow['idgen']=eqb()->project($project_id)->entityType('SMPL_ID_GENERATOR')->get();
$workflow['caseTypes']=eqb()->project($project_id)->entityType('SMPL_CASE_TYPE')->where('smpl_workflow_fk','=',$wfid)->get();
$workflow['eventTypes']=eqb()->project($project_id)->entityType('SMPL_EVENT_TYPE')->get();
foreach($workflow['lines'] as &$line){
    $steps=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_line_fk','=',$line['id'])->get();
    usort($steps,'smplSortByOrder');
    foreach($steps as &$step){$et=eqb()->entityType('SMPL_EVENT_TYPE')->where('id','=',$step['smpl_event_type_fk'])->get()[0];$step['type']=$et['smpl_label'];}
    unset($step); $line['steps']=$steps;
}
unset($line);
$allSteps=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_fk','=',$wfid)->get();
$batches=array_values(array_filter($allSteps,function($s){return !empty($s['smpl_workflow_step_is_batch']);}));
foreach($batches as &$batch){
    $et=eqb()->entityType('SMPL_EVENT_TYPE')->where('id','=',$batch['smpl_event_type_fk'])->get()[0]; $batch['type']=$et['smpl_label'];
    $steps=eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_step_batch_fk','=',$batch['id'])->get();
    $steps=array_values(array_filter($steps,function($s)use($workflow){return is_numeric(array_search($s['smpl_workflow_line_fk'],array_column($workflow['lines'],'id')));}));
    foreach($steps as &$step){$et=eqb()->entityType('SMPL_EVENT_TYPE')->where('id','=',$step['smpl_event_type_fk'])->get()[0];$step['type']=$et['smpl_label'];}
    unset($step); $batch['steps']=$steps;
}
unset($batch);
$workflow['batches']=$batches; $workflow['statuses']=eqb()->project($project_id)->entityType('SMPL_STATUS')->get();
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode($workflow));
PHP,
            ],
            [
                'name' => 'smpl_get_entity_by_barcode',
                'type' => 'GET',
                'code' => <<<'PHP'
$project_id=$this->request->projectId; $barcode=$this->request->barcode;
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$s=eqb()->project($project_id)->entityType('SMPL_SAMPLE')->where('BARCODE','=',$barcode)->get(); if($s){$this->response->setResponseContent(json_encode($s));return;}
$k=eqb()->project($project_id)->entityType('SMPL_KIT')->where('BARCODE','=',$barcode)->get(); if($k){$this->response->setResponseContent(json_encode($k));return;}
$c=eqb()->project($project_id)->entityType('SMPL_CASE')->where('BARCODE','=',$barcode)->get(); if($c){$this->response->setResponseContent(json_encode($c));return;}
$su=eqb()->project($project_id)->entityType('SMPL_SUBJECT')->where('BARCODE','=',$barcode)->get();
$this->response->setResponseContent(json_encode($su?:[]));
PHP,
            ],
            [
                'name' => 'smpl_get_samples_by_steps',
                'type' => 'GET',
                'code' => <<<'PHP'
$project_id=$this->request->projectId; $choiceId=$this->request->choice; $steps=$this->request->steps;
$all=[];
foreach($steps as $id){
    $q=eqb()->project($project_id)->entityType('SMPL_SAMPLE')->where('smpl_workflow_step_fk','=',$id);
    if($choiceId)$q->where('smpl_sample_status_fk','=',$choiceId);
    foreach($q->get() as $s){$all[]=$s;}
}
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode($all));
PHP,
            ],
            [
                'name' => 'smpl_get_samples_by_kit',
                'type' => 'GET',
                'code' => <<<'PHP'
$kit=$this->request->kit;
$samples=eqb()->entityType('SMPL_SAMPLE')->where('smpl_kit_fk','=',$kit)->get();
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode($samples));
PHP,
            ],
            [
                'name' => 'smpl_get_sample_counts',
                'type' => 'GET',
                'code' => <<<'PHP'
$project_id=$this->request->projectId; $stepid=$this->request->stepId;
$subject=$this->request->subject; $casus=$this->request->casus; $kit=$this->request->kit;
$counts=[];
if($stepid){
    foreach($stepid as $id){$counts[$id]=[];}
    $statuses=eqb()->project($project_id)->entityType('SMPL_STATUS')->get();
    $active=array_values(array_filter($statuses,function($s){return $s['smpl_status_is_active'];}));
    if(!empty($active)){
        $activeIds=array_column($active,'id'); $byId=[];
        foreach($active as $s){$byId[$s['id']]=$s;}
        $q=eqb()->project($project_id)->entityType('SMPL_SAMPLE')->select(['smpl_workflow_step_fk','smpl_sample_status_fk'])->where('smpl_workflow_step_fk','in',$stepid)->where('smpl_sample_status_fk','in',$activeIds);
        if($kit)    $q->whereBracket(function($q)use($kit)    {$q->where('smpl_kit_fk','in',$kit)->orWhere('smpl_kit_fk','has not',null);});
        if($casus)  $q->whereBracket(function($q)use($casus)  {$q->where('smpl_case_fk','in',$casus)->orWhere('smpl_case_fk','has not',null);});
        if($subject)$q->whereBracket(function($q)use($subject){$q->where('smpl_subject_fk','in',$subject)->orWhere('smpl_subject_fk','has not',null);});
        foreach($q->get() as $sample){
            $sk=$sample['smpl_workflow_step_fk']; $tk=$sample['smpl_sample_status_fk'];
            if(!isset($counts[$sk])||!isset($byId[$tk]))continue;
            $found=false;
            foreach($counts[$sk] as &$e){if($e['status']['id']==$tk){$e['count']++;$found=true;break;}}unset($e);
            if(!$found)$counts[$sk][]=['status'=>$byId[$tk],'count'=>1];
        }
    }
}
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode($counts));
PHP,
            ],
            [
                'name' => 'smpl_generate_id',
                'type' => 'POST',
                'code' => <<<'PHP'
$entity=$this->request['entity']; $template=$this->request['template'];
$entityId=$this->request['entityId']; $templateId=$this->request['templateId'];
if(isset($entityId))$entity=eqb()->where('id','=',$entityId)->get()[0];
if(isset($templateId))$template=eqb()->where('id','=',$templateId)->get()[0];
$vars=['entity'=>$entity,'study'=>isset($entity['smpl_study_fk'])?eqb()->where('id','=',$entity['smpl_study_fk'])->get()[0]:null,'subject'=>isset($entity['smpl_subject_fk'])?eqb()->where('id','=',$entity['smpl_subject_fk'])->get()[0]:null,'breed'=>isset($entity['smpl_subject_breed_fk'])?eqb()->where('id','=',$entity['smpl_subject_breed_fk'])->get()[0]:null,'case'=>isset($entity['smpl_case_fk'])?eqb()->where('id','=',$entity['smpl_case_fk'])->get()[0]:null,'caseType'=>isset($entity['smpl_case_type_fk'])?eqb()->where('id','=',$entity['smpl_case_type_fk'])->get()[0]:null,'kit'=>isset($entity['smpl_kit_fk'])?eqb()->where('id','=',$entity['smpl_kit_fk'])->get()[0]:null,'line'=>isset($entity['smpl_workflow_line_fk'])?eqb()->where('id','=',$entity['smpl_workflow_line_fk'])->get()[0]:null,'parentSample'=>isset($entity['smpl_sample_fk'])?eqb()->where('id','=',$entity['smpl_sample_fk'])->get()[0]:null];
$line=$vars['line'];
if(isset($line['smpl_id_gen_fk'])&&!isset($template))$template=eqb()->where('id','=',$line['smpl_id_gen_fk'])->get()[0];
$rv=function(string $str,array $vars):string{return preg_replace_callback('/\$(\w+)(?:\[\s*[\'"]([^\'"]+)[\'"]\s*\])?/',function($m)use($vars){if(isset($m[2]))return(isset($vars[$m[1]])&&is_array($vars[$m[1]])&&array_key_exists($m[2],$vars[$m[1]]))?$vars[$m[1]][$m[2]]:'';return isset($vars[$m[1]])?(string)$vars[$m[1]]:'';}, $str);};
$rwt=function(string $str,array $vars)use(&$rwt,$rv):string{$str=$rv($str,$vars);while(preg_match('/\{([^{}]*?)\s*\?\s*(.*?)\s*:\s*(.*?)\}/',$str,$m)){$str=str_replace($m[0],!empty($rv($m[1],$vars))?$rwt($m[2],$vars):$rwt($m[3],$vars),$str);}return $str;};
$stem=$rwt($template['smpl_id_generator_mask'],$vars);
$length=$template['smpl_id_generator_nb_length']??0; $sep=$template['smpl_id_generator_separator']??null;
$entities=array_values(array_filter(eqb()->where('smpl_id_stem','=',$stem)->where('smpl_id_nb','has',null)->get(),fn($i)=>($i['smpl_id_stem']??null)===$stem));
usort($entities,fn($a,$b)=>$b['smpl_id_nb']<=>$a['smpl_id_nb']);
$count=($length==0)?0:1;
foreach($entities as $i){if($i['smpl_id_nb']>=$count)$count=$i['smpl_id_nb']+1;}
if(isset($entity['smpl_order']))$count+=$entity['smpl_order'];
$nb=($length==0)?'':str_pad((string)$count,$length,'0',STR_PAD_LEFT);
$this->response->setResponseHeaders(['content-type'=>'application/json']);
$this->response->setResponseContent(json_encode(['stem'=>$stem,'count'=>$nb,'separator'=>$sep,'nb'=>$count,'id'=>$stem.$sep.$nb,'entity'=>$entity,'template'=>$template,'vars'=>$vars,'entities'=>$entities]));
PHP,
            ],
        ];
    }
}
