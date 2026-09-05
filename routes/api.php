<?php

use Illuminate\Support\Facades\Route;

Route::prefix('smpl')->group(function () {

    // ─── GET /api/smpl/workflows ─────────────────────────────────────────────
    Route::get('workflows', function () {
        $projectId = request('projectId');
        $workflows = eqb()->project($projectId)->entityType('SMPL_WORKFLOW')->get();
        foreach ($workflows as &$workflow) {
            $study = eqb()->project($projectId)->entityType('SMPL_STUDY')
                ->where('id', '=', $workflow['smpl_study_fk'])->get();
            $workflow['study'] = ($study[0] ?? [])['smpl_label'] ?? null;
        }
        unset($workflow);
        return response()->json($workflows);
    });

    // ─── GET /api/smpl/load-workflow?workflowId=&caseTypeId= ─────────────────
    Route::get('load-workflow', function () {
        $projectId = request('projectId');
        $wfid      = request('workflowId');
        $ctid      = request('caseTypeId');

        $getChildLines = function (int $parentId) use (&$getChildLines, $projectId): array {
            $children = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_LINE')
                ->where('smpl_workflow_line_fk', '=', $parentId)->get();
            foreach ($children as $child) {
                $children = array_merge($children, $getChildLines($child['id']));
            }
            return $children;
        };

        $workflow = eqb()->project($projectId)->entityType('SMPL_WORKFLOW')->where('id', '=', $wfid)->get()[0];
        $study    = eqb()->project($projectId)->entityType('SMPL_STUDY')->where('id', '=', $workflow['smpl_study_fk'])->get();

        if ($ctid) {
            $lineIds = eqb()->project($projectId)->entityType('SMPL_CASE_TYPE')->where('id', '=', $ctid)->get()[0]['smpl_workflow_lines_fk'];
            $lines   = [];
            foreach ($lineIds as $lineId) {
                $lines[] = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_LINE')->where('id', '=', $lineId)->get()[0];
                $lines   = array_merge($lines, $getChildLines($lineId));
            }
        } else {
            $lines = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_LINE')->where('smpl_workflow_fk', '=', $wfid)->get();
        }
        usort($lines, fn ($a, $b) => $a['smpl_order'] <=> $b['smpl_order']);

        $workflow['lines']      = $lines;
        $workflow['study']      = ($study[0] ?? [])['smpl_label'] ?? null;
        $workflow['idgen']      = eqb()->project($projectId)->entityType('SMPL_ID_GENERATOR')->get();
        $workflow['caseTypes']  = eqb()->project($projectId)->entityType('SMPL_CASE_TYPE')->where('smpl_workflow_fk', '=', $wfid)->get();
        $workflow['eventTypes'] = eqb()->project($projectId)->entityType('SMPL_EVENT_TYPE')->get();

        foreach ($workflow['lines'] as &$line) {
            $steps = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_STEP')
                ->where('smpl_workflow_line_fk', '=', $line['id'])->get();
            usort($steps, fn ($a, $b) => $a['smpl_order'] <=> $b['smpl_order']);
            foreach ($steps as &$step) {
                $eventType    = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $step['smpl_event_type_fk'])->get()[0];
                $step['type'] = $eventType['smpl_label'];
            }
            unset($step);
            $line['steps'] = $steps;
        }
        unset($line);

        $allSteps = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_fk', '=', $wfid)->get();
        $batches  = array_values(array_filter($allSteps, fn ($s) => !empty($s['smpl_workflow_step_is_batch'])));
        foreach ($batches as &$batch) {
            $eventType     = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $batch['smpl_event_type_fk'])->get()[0];
            $batch['type'] = $eventType['smpl_label'];
            $steps = eqb()->project($projectId)->entityType('SMPL_WORKFLOW_STEP')
                ->where('smpl_workflow_step_batch_fk', '=', $batch['id'])->get();
            $steps = array_values(array_filter($steps, function ($step) use ($workflow) {
                return is_numeric(array_search($step['smpl_workflow_line_fk'], array_column($workflow['lines'], 'id')));
            }));
            foreach ($steps as &$step) {
                $eventType    = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $step['smpl_event_type_fk'])->get()[0];
                $step['type'] = $eventType['smpl_label'];
            }
            unset($step);
            $batch['steps'] = $steps;
        }
        unset($batch);
        $workflow['batches']  = $batches;
        $workflow['statuses'] = eqb()->project($projectId)->entityType('SMPL_STATUS')->get();

        return response()->json($workflow);
    });

    // ─── GET /api/smpl/entity-by-barcode?barcode= ────────────────────────────
    Route::get('entity-by-barcode', function () {
        $projectId = request('projectId');
        $barcode   = request('barcode');

        $samples = eqb()->project($projectId)->entityType('SMPL_SAMPLE')->where('BARCODE', '=', $barcode)->get();
        if ($samples) return response()->json($samples);
        $kit = eqb()->project($projectId)->entityType('SMPL_KIT')->where('BARCODE', '=', $barcode)->get();
        if ($kit) return response()->json($kit);
        $case = eqb()->project($projectId)->entityType('SMPL_CASE')->where('BARCODE', '=', $barcode)->get();
        if ($case) return response()->json($case);
        $subject = eqb()->project($projectId)->entityType('SMPL_SUBJECT')->where('BARCODE', '=', $barcode)->get();
        return response()->json($subject ?: []);
    });

    // ─── GET /api/smpl/samples-by-steps?steps[]=&choice= ────────────────────
    Route::get('samples-by-steps', function () {
        $projectId = request('projectId');
        $choiceId  = request('choice');
        $steps     = request('steps', []);
        $allsamples = [];
        foreach ($steps as $id) {
            $query = eqb()->project($projectId)->entityType('SMPL_SAMPLE')->where('smpl_workflow_step_fk', '=', $id);
            if ($choiceId) {
                $query->where('smpl_sample_status_fk', '=', $choiceId);
            }
            foreach ($query->get() as $sample) {
                $allsamples[] = $sample;
            }
        }
        return response()->json($allsamples);
    });

    // ─── GET /api/smpl/sample-counts?stepId[]=&subject=&casus=&kit= ──────────
    Route::get('sample-counts', function () {
        $projectId = request('projectId');
        $stepid    = request('stepId', []);
        $subject   = request('subject');
        $casus     = request('casus');
        $kit       = request('kit');
        $counts    = [];

        if ($stepid) {
            foreach ($stepid as $id) {
                $counts[$id] = [];
            }

            $statuses       = eqb()->project($projectId)->entityType('SMPL_STATUS')->get();
            $activeStatuses = array_values(array_filter($statuses, fn ($s) => $s['smpl_status_is_active']));

            if (!empty($activeStatuses)) {
                $activeStatusIds = array_column($activeStatuses, 'id');
                $statusById      = array_column($activeStatuses, null, 'id');

                $query = eqb()->project($projectId)->entityType('SMPL_SAMPLE')
                    ->select(['smpl_workflow_step_fk', 'smpl_sample_status_fk'])
                    ->where('smpl_workflow_step_fk', 'in', $stepid)
                    ->where('smpl_sample_status_fk', 'in', $activeStatusIds);

                if ($kit) {
                    $query->whereBracket(fn ($q) => $q->where('smpl_kit_fk', 'in', $kit)->orWhere('smpl_kit_fk', 'has not', null));
                }
                if ($casus) {
                    $query->whereBracket(fn ($q) => $q->where('smpl_case_fk', 'in', $casus)->orWhere('smpl_case_fk', 'has not', null));
                }
                if ($subject) {
                    $query->whereBracket(fn ($q) => $q->where('smpl_subject_fk', 'in', $subject)->orWhere('smpl_subject_fk', 'has not', null));
                }

                foreach ($query->get() as $sample) {
                    $stepKey   = $sample['smpl_workflow_step_fk'];
                    $statusKey = $sample['smpl_sample_status_fk'];
                    if (!isset($counts[$stepKey]) || !isset($statusById[$statusKey])) {
                        continue;
                    }
                    $found = false;
                    foreach ($counts[$stepKey] as &$entry) {
                        if ($entry['status']['id'] == $statusKey) {
                            $entry['count']++;
                            $found = true;
                            break;
                        }
                    }
                    unset($entry);
                    if (!$found) {
                        $counts[$stepKey][] = ['status' => $statusById[$statusKey], 'count' => 1];
                    }
                }
            }
        }

        return response()->json($counts);
    });

    // ─── POST /api/smpl/generate-id ──────────────────────────────────────────
    Route::post('generate-id', function () {
        $entity     = request('entity');
        $template   = request('template');
        $entityId   = request('entityId');
        $templateId = request('templateId');

        if (isset($entityId))   $entity   = eqb()->where('id', '=', $entityId)->get()[0];
        if (isset($templateId)) $template = eqb()->where('id', '=', $templateId)->get()[0];

        $vars = [
            'entity'       => $entity,
            'study'        => isset($entity['smpl_study_fk'])         ? eqb()->where('id', '=', $entity['smpl_study_fk'])->get()[0]         : null,
            'subject'      => isset($entity['smpl_subject_fk'])       ? eqb()->where('id', '=', $entity['smpl_subject_fk'])->get()[0]       : null,
            'breed'        => isset($entity['smpl_subject_breed_fk']) ? eqb()->where('id', '=', $entity['smpl_subject_breed_fk'])->get()[0] : null,
            'case'         => isset($entity['smpl_case_fk'])          ? eqb()->where('id', '=', $entity['smpl_case_fk'])->get()[0]          : null,
            'caseType'     => isset($entity['smpl_case_type_fk'])     ? eqb()->where('id', '=', $entity['smpl_case_type_fk'])->get()[0]     : null,
            'kit'          => isset($entity['smpl_kit_fk'])           ? eqb()->where('id', '=', $entity['smpl_kit_fk'])->get()[0]           : null,
            'line'         => isset($entity['smpl_workflow_line_fk']) ? eqb()->where('id', '=', $entity['smpl_workflow_line_fk'])->get()[0] : null,
            'parentSample' => isset($entity['smpl_sample_fk'])        ? eqb()->where('id', '=', $entity['smpl_sample_fk'])->get()[0]        : null,
        ];
        $line = $vars['line'];

        if (isset($line['smpl_id_gen_fk']) && !isset($template)) {
            $template = eqb()->where('id', '=', $line['smpl_id_gen_fk'])->get()[0];
        }

        $replaceVariables = function (string $str, array $vars): string {
            return preg_replace_callback(
                '/\$(\w+)(?:\[\s*[\'"]([^\'"]+)[\'"]\s*\])?/',
                function ($matches) use ($vars) {
                    if (isset($matches[2])) {
                        $k = $matches[2];
                        return (isset($vars[$matches[1]]) && is_array($vars[$matches[1]]) && array_key_exists($k, $vars[$matches[1]])) ? $vars[$matches[1]][$k] : '';
                    }
                    return isset($vars[$matches[1]]) ? (string) $vars[$matches[1]] : '';
                },
                $str
            );
        };

        $replaceWithTernary = function (string $str, array $vars) use (&$replaceWithTernary, $replaceVariables): string {
            $str = $replaceVariables($str, $vars);
            while (preg_match('/\{([^{}]*?)\s*\?\s*(.*?)\s*:\s*(.*?)\}/', $str, $m)) {
                $condition   = $replaceVariables($m[1], $vars);
                $selectedVal = !empty($condition) ? $m[2] : $m[3];
                $str         = str_replace($m[0], $replaceWithTernary($selectedVal, $vars), $str);
            }
            return $str;
        };

        $stem      = $replaceWithTernary($template['smpl_id_generator_mask'], $vars);
        $length    = $template['smpl_id_generator_nb_length'] ?? 0;
        $separator = $template['smpl_id_generator_separator'] ?? null;

        $entities = array_values(array_filter(
            eqb()->where('smpl_id_stem', '=', $stem)->where('smpl_id_nb', 'has', null)->get(),
            fn ($item) => ($item['smpl_id_stem'] ?? null) === $stem
        ));
        usort($entities, fn ($a, $b) => $b['smpl_id_nb'] <=> $a['smpl_id_nb']);

        $count = ($length == 0) ? 0 : 1;
        foreach ($entities as $item) {
            if ($item['smpl_id_nb'] >= $count) {
                $count = $item['smpl_id_nb'] + 1;
            }
        }
        if (isset($entity['smpl_order'])) {
            $count += $entity['smpl_order'];
        }

        $nb = ($length == 0) ? '' : str_pad((string) $count, $length, '0', STR_PAD_LEFT);

        return response()->json([
            'stem'      => $stem,
            'count'     => $nb,
            'separator' => $separator,
            'nb'        => $count,
            'id'        => $stem.$separator.$nb,
            'entity'    => $entity,
            'template'  => $template,
            'vars'      => $vars,
            'entities'  => $entities,
        ]);
    });
});
