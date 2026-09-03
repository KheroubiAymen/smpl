// =============================================
// VERSION — modifier ici uniquement

// =============================================

{
  data() {
    // CONSTANTES
    const SMPL_VERSION = '2.4.11'
    const GRID_ORIGIN = [100, 180];
    const GRID_STEP = [300, 140];

    return {
      // CONFIG — modifier ici uniquement
      COLLECTION_START_TIME_ENABLED: true, // false = ne pas stocker smpl_collection_start_time sur les samples

      // CONFIGURATION INITIALE
      isLoading: true,
      loadingStep: 0,
      loadingSteps: [
        "Loading resources...",
        "Processing data...",
        "Setting up graphics...",
        "Preparing workflow...",
        "Finalizing setup..."
      ],
      loadingProgress: 0,
      loadingMessage: "Loading...",
      appVersion: SMPL_VERSION,
      
      // DONNÉES DE BASE
      links: [],
      workflow: null,
      workflows: [],
      steps: [],
      pipeline: [],
      entityTypes: [],
      counts: [],
      selected: [],
      toBeSelected: [],
      width: 100,
      height: 100,
      grid: {
        "origin": GRID_ORIGIN,
        "step": GRID_STEP
      },
      zoom: null,
      zoomScale: 1,
      
      // ÉTAT DE L'APPLICATION
      loading: false,
      currentEntities: {
        "subjects": [],
        "cases": [],
        "kits": [],
        "samples": []
      },
      customViewIds: {
        "subjects": undefined,
        "cases": undefined,
        "kits": undefined,
        "samples": undefined
      },
      pipeline: [],
      forms: [],
      currentEventSamples: [],
      defaultEntity: undefined,
      customViewId: undefined,
      customView: undefined,
      selectedCustomViewEntitiesIds: [],
      customViewData: {
        "title": null,
        "type": null
      },
      changedFormValues: {},
        formCache: new Map(),
  formCacheTTL: 10 * 60 * 1000, // 10 minutes
  formCacheTimestamps: new Map(),
      collectionOngoing: false,
      ongoingCollectionFk: null,
      nonAutoSampleCreation: false,
      sampleCreationFormId: null,
      displayForms: false,
      event_done_by: null,
      currentProject: null,
      activeStatus: [],
      resources: {},

      // Filtre "type de cas" (toolbar) — voir QUANTITÉ PAR TYPE DE CAS plus bas.
      // null = jamais touché, suit automatiquement le(s) case(s) sélectionné(s) ;
      // 'ALL' = "All case types" explicitement choisi (pas de filtre) ; tableau
      // = un ou plusieurs types cochés explicitement (multi-sélection).
      selectedCaseTypeFilter: null,
      caseTypeFilterOptions: [],
      // Dropdown "Case type" — remplace le <select multiple> natif (rendu
      // moche et non fonctionnel par le CSS/JS global de la plateforme qui
      // intercepte tous les <select> de la page) par un menu custom en div,
      // ouvert/fermé via ce flag. Voir toggleCaseTypeDropdown().
      caseTypeDropdownOpen: false,
      // Résolution sample -> type de cas via sample.smpl_case_fk -> case.smpl_case_type_fk
      // (le sample lui-même ne porte pas ce champ). Nécessaire pour filtrer les
      // samples affichés/comptés par type de cas quand aucun case n'est
      // sélectionné (donc currentEntities.cases ne peut pas servir de source) —
      // voir filterSamplesByCaseType(). Cache id de case -> type de cas, rempli
      // à la demande via le getEntity(id) déjà utilisé partout ailleurs dans ce
      // fichier (ex: selectCases()). Reset à chaque changement de workflow (voir
      // loadWorkflow()), pas de TTL : le type de cas d'une case ne change pour
      // ainsi dire jamais une fois créée.
      caseTypeByCaseId: new Map(),

      // Side bar de navigation entre workflows — remplace le dropdown <select>
      // de la toolbar, même principe que smpl config : rétractable (fermé par
      // défaut sauf si épinglé), triable, favoris. localStorage avec des clés
      // dédiées à smpl normal (smpl*), séparées de celles de smpl config
      // (smplConfig*) — deux publics différents, favoris indépendants.
      sidebarCollapsed: true,
      sidebarSearch: '',
      sidebarPinned: false,
      // Tri à 3 états de la liste plate du side bar, par colonne ('name' ou
      // 'date' — proxy: id) : null = pas de tri (ordre par défaut) -> 1er clic
      // sur une colonne = descendant -> 2e clic = ascendant -> 3e clic = retour
      // à null. Voir toggleSidebarSort().
      sidebarSortField: null,
      sidebarSortDir: 'desc',
      favoriteWorkflowIds: []
    };
  },

  computed: {
    loadedForms() {
      if (this.forms.length > 0)
        return this.forms.every(form => form.form);
    },
    isValidforms() {
      return this.forms.every(form => form.isValidForm);
    },
    // undefined/null (workflow créé avant l'existence de ce champ, ou pas
    // encore passé par le wizard de smpl config) -> true : les cas ont
    // toujours été obligatoires par le passé, donc un workflow "legacy" en
    // utilise forcément. Seul smpl_workflow_uses_cases === false (choix
    // explicite dans le wizard) désactive tout le flux "case" ici.
    usesCases() {
      return this.workflow?.smpl_workflow_uses_cases !== false;
    },
    // Side bar : liste filtrée par la recherche texte (nom du workflow ou de
    // l'étude) — même principe que smpl config.
    filteredSidebarWorkflows() {
      const q = (this.sidebarSearch || '').toLowerCase().trim();
      if (!q) return this.workflows;
      return this.workflows.filter(wf => (wf.smpl_label || '').toLowerCase().includes(q) || (wf.study || '').toLowerCase().includes(q));
    },
    // Liste à plat (pas de groupement par étude) : favoris toujours en tête,
    // puis triée selon sidebarSortField/sidebarSortDir (voir toggleSidebarSort())
    // — sidebarSortField null = pas de tri secondaire, conserve l'ordre par
    // défaut (celui de filteredSidebarWorkflows) grâce à la stabilité garantie
    // de Array.prototype.sort.
    sortedSidebarWorkflows() {
      const list = [...this.filteredSidebarWorkflows];
      list.sort((a, b) => {
        const aFav = this.favoriteWorkflowIds.includes(a.id) ? 0 : 1;
        const bFav = this.favoriteWorkflowIds.includes(b.id) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        if (!this.sidebarSortField) return 0;
        const cmp = this.sidebarSortField === 'date'
          ? a.id - b.id
          : (a.smpl_label || '').localeCompare(b.smpl_label || '');
        return this.sidebarSortDir === 'desc' ? -cmp : cmp;
      });
      return list;
    },
    // Décalage à gauche du canvas SVG pour ne jamais rendre de contenu sous
    // le side bar — voir onResize() qui applique le même décalage à `width`.
    // Design 2.4.0 — largeurs alignées sur .dd-sidebar/.dd-sidebar-collapsed
    // (48px/264px) après le restylage du side bar, sinon le canvas déborde
    // légèrement sous/au-delà du panneau.
    svgOffsetLeft() {
      return this.sidebarCollapsed ? 48 : 264;
    }
  },

  methods: {
    //==========================
    // GESTION DU CHARGEMENT
    //==========================
    
    updateLoadingProgress(step) {
      this.loadingStep = step;
    },

    //==========================
    // GESTION DE L'AFFICHAGE
    //==========================
    
    onResize() {
      this.height = window.innerHeight - 71;
      this.width = window.innerWidth - 8 - this.svgOffsetLeft;
    },
    
    handleZoom(e) {
      this.zoomScale = e.transform.k;
      d3.selectAll(".layer").attr('transform', e.transform);
    },
    
    getCanvasSvg() {
      // d3.select('svg') prend le PREMIER svg du DOM, qui peut être une icône DiData.
      // On remonte depuis #nodeLayer pour cibler le bon SVG canvas.
      const nodeLayer = document.getElementById('nodeLayer');
      const svgNode = nodeLayer ? nodeLayer.closest('svg') : null;
      return svgNode ? d3.select(svgNode) : d3.select('svg');
    },

    initZoom() {
      this.getCanvasSvg().call(this.zoom);
    },
    
    applyCssStyle() {
      // Mettre à jour le height de la grid
      const css = '.body { height: 500px !important; }';
      const head = document.head || document.getElementsByTagName('head')[0];
      const style = document.createElement('style');
      head.appendChild(style);
      style.type = 'text/css';
      if (style.styleSheet) {
        // This is required for IE8 and below.
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }

      d3.select("#developpedBySBP").append("img").attr("src", this.resources.LOGO_SBP);
    },

    //==========================
    // ROUTES ET RESSOURCES API
    //==========================
    
    async getResources(resources) {
      const tFolders = performance.now();
      // get folders
      const folders = await this.dapp.$axios.$get(`/folders`);
      console.log(`[perf] getResources: GET /folders took ${(performance.now() - tFolders).toFixed(0)}ms (${folders.length} folders)`);
      const folderId = folders.find(folder => folder.name == "smpl_resources")?.id;

      if (folderId) {
        const tFiles = performance.now();
        const files = await this.dapp.$axios.$get(`/folders/${folderId}/files`);
        console.log(`[perf] getResources: GET /folders/${folderId}/files took ${(performance.now() - tFiles).toFixed(0)}ms (${files.length} files)`);

        // Récupérer tous les liens de téléchargement EN PARALLÈLE plutôt qu'un par un —
        // c'était la première cause de lenteur perçue de l'écran de chargement (7
        // allers-retours réseau strictement séquentiels au lieu d'un seul lot concurrent).
        const tLinks = performance.now();
        await Promise.all(resources.map(async resource => {
          const fileId = files.find(file => file.name == resource.name)?.id;

          if (fileId) {
            const link = await this.dapp.$axios.$get(`/files/download-link/${fileId}`);
            this.resources[resource.key] = link.link.replace("smia_chuv", "chuv").replace("http://", "https://");
          } else {
            await this.$toastNotifier.notifyError('Missing file: ' + resource.name);
          }
        }));
        console.log(`[perf] getResources: ${resources.length} download-link fetches (parallel) took ${(performance.now() - tLinks).toFixed(0)}ms`);
      } else {
        await this.$toastNotifier.notifyError('Missing folder: smpl_resources');
      }
    },
    
    async getRouteURLByName(name) {
      const routes = await this.dapp.$axios.$get(`/user-routes`);
      const route = routes.find(route => route.name == name).url.replace("smia_chuv", "chuv").replace("http://", "https://");
      const currentProject = $nuxt.$store.getters['currentUser/getCurrentProject'];
      return `${route}?projectId${currentProject.id ? "=" + currentProject.id : ""}`;
    },

    //==========================
    // MÉTHODES DE RÉCUPÉRATION DE DONNÉES
    //==========================
    
    async getEntity(id) {
      if (id) {
        return await this.dapp.$axios.$get(`/entities/${id}`);
      }
      return undefined;
    },
    
    async getSamples(ids) {
      let uri = await this.getRouteURLByName('smpl_get_samples_by_steps');
      for (let i = 0; i < ids.length; i++) {
        uri += (i == 0 ? '&steps[]=' : '&steps[]=') + ids[i];
      }
      return await this.dapp.$axios.$get(uri);
    },
    
    async getSamplesByKit(kitId) {
      let uri = await this.getRouteURLByName('smpl_get_samples_by_kit');
      uri += '&kit=' + kitId;
      return await this.dapp.$axios.$get(uri);
    },
    
    getEventTypeByName(name) {
      return this.workflow.eventTypes.find(et => et.smpl_label == name);
    },
    
    getEventTypeById(id) {
      return this.workflow.eventTypes.find(et => et.id == id);
    },
    
    getEntityType(name) {
      return this.entityTypes.find(et => et.name == name);
    },
    
    getFieldByName(name) {
      return $nuxt.$store.state.fields.fields.find(field => field.name == name);
    },

    //==========================
    // MÉTHODES UTILITAIRES
    //==========================
    
    async setFormIds() {
      const forms = await this.dapp.$axios.$get('/forms');
      this.sampleCreationFormId = forms.find(form => form.name == "smpl_creation_prompt").id;
    },
    
    getStep(stepId) {
      const batch = this.workflow.batches.find(batch => batch.id == stepId);
      if (batch) return batch;
      
      for (let l = 0; l < this.workflow.lines.length; l++) {
        const line = this.workflow.lines[l];
        for (let s = 0; s < line.steps.length; s++) {
          const step = line.steps[s];
          if (step.id == stepId) return step;
        }
      }
      return undefined;
    },
    
    getLine(lineId) {
      return this.workflow.lines.find(line => line.id == lineId);
    },
    
    getBatch(id) {
      return this.workflow.batches.find(batch => batch.id == id);
    },
    
    getChoiceId(categoryName, choiceValue) {
      const category = this.$store.state.fields.choiceCategories.find(category => category.name == categoryName);
      return category._choices.find(choice => choice.value == choiceValue).id;
    },
    
    getChoiceValue(choiceId) {
      let value;
      this.$store.state.fields.choiceCategories.forEach(category => {
        const choice = category._choices.find(choice => choice.id == choiceId);
        if (choice) value = choice.value;
      });
      return value;
    },
    
    getChoiceDescription(choiceId) {
      let description;
      this.$store.state.fields.choiceCategories.forEach(category => {
        const choice = category._choices.find(choice => choice.id == choiceId);
        if (choice) description = choice.description;
      });
      return description;
    },
    
    getStatusId(label) {
      const status = this.workflow.statuses.find(status => status.smpl_label == label);
      return status?.id;
    },
    
    statusIsActive(id) {
      const status = this.workflow.statuses.find(status => status.id == id);
      return status?.smpl_status_is_active;
    },
    
    async getAllWorkflows(id = null) {
      let is_wf = false;
      if (id) {
        const entity = await this.dapp.$axios.$get(`/entities/${id}`);
        if (entity?.smpl_study_fk) is_wf = true;
      }
      
      const response = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_get_all_workflows'));
      response.filter(workflow => id ? (is_wf ? workflow.id == id : workflow.smpl_study_fk == id) : true).forEach(workflow => {
        this.workflows.push(workflow);
      });
    },
    
    getAllEntityTypes() {
      this.entityTypes = this.$store.state.entityTypes.entityTypes;
      this.entityTypes.forEach(et => {
        et["_fields"] = [];
      });
      
      const fields = this.$store.state.fields.fields;
      fields.forEach(field => {
        field._entitytypes.forEach(fet => {
          let et = this.entityTypes.find(et => et.id == fet.id);
          if (et) et["_fields"].push(field);
        });
      });

      this.entityTypes.forEach(et => { 
        et.name = et.name.replace("_ce_", "_");
      });
    },

    //==========================
    // GESTION DE LA VISUALISATION DU WORKFLOW
    //==========================
    
    setHorizontalPositions() {
      const workflowLines = this.workflow.lines.filter(line => line.visible && line?._matchesCaseTypeFilter !== false && line?.steps.length > 0);

      let positions = [];
      for (let i = 0; i < workflowLines.length; i++) {
        var line = workflowLines[i];
        if (line?.smpl_workflow_line_fk) {
          let index = positions.findLastIndex(position => position.smpl_workflow_line_fk == line.smpl_workflow_line_fk);
          if (index < 0) index = positions.findIndex(position => position.id == line.smpl_workflow_line_fk);

          positions.splice(index + 1, 0, line);
        } else {
          positions.push(line);
        }
      }
      
      for (let i = 0; i < positions.length; i++) {
        var line = positions[i];
        line.x = i + 1;
      }
    },
    
    async setVerticalPositions() {
      this.workflow.batches.forEach(batch => {
        batch.xMax = 0;
      });

      const lines = this.workflow.lines.filter(line => line.visible && line?._matchesCaseTypeFilter !== false && line?.steps.length > 0);

      // Lignes aliquots (dérivées d'un step, smpl_workflow_line_fk défini)
      // toujours placées EN DESSOUS de toutes les lignes normales, au lieu
      // d'être positionnées à la hauteur de leur step parent (show_hierarchy)
      // ou juste après leur ligne parente (mode plat) — ça les mélangeait
      // visuellement avec les lignes normales au lieu de les distinguer en bas.
      const topLevelLines = lines.filter(line => !line?.smpl_workflow_line_fk);
      const derivedLines = lines.filter(line => line?.smpl_workflow_line_fk);

      let maxYUsed = -1;

      const positionLine = (line, startPosition) => {
        var position = startPosition;

        line.steps.sort((a, b) => (a.fy ? a.fy : a.y) - (b.fy ? b.fy : b.y));

        line.steps.forEach((step, index) => {
          if (step?.smpl_workflow_step_batch_fk) {
            const batch = this.workflow.batches.find(batch => batch.id == step.smpl_workflow_step_batch_fk);
            if (!batch?.y) batch.y = 0;
            batch.y = Math.max(position, batch.y);
            position = batch.y;
            batch.xMin = batch.xMin ? Math.min(batch.xMin, step.x) : step.x;
            batch.xMax = batch.xMax ? Math.max(batch.xMax, step.x) : step.x;
          }

          while (this.workflow.batches.find(batch => batch.y == position && batch.id != step?.smpl_workflow_step_batch_fk)) {
            position++;
          }

          step.y = line.smpl_workflow_line_is_kit && step.smpl_order == 0 ? 0 : position;
          step.x = line.x;
          position++;
          if (step.y > maxYUsed) maxYUsed = step.y;
        });
      };

      // 1er passage : toutes les lignes normales, comme avant (position part
      // toujours de 0 pour celles-ci — l'ancien code ne branchait jamais sur
      // le calcul parent-based pour une ligne sans smpl_workflow_line_fk).
      topLevelLines.forEach(line => positionLine(line, 0));

      // 2e passage : chaque ligne aliquot démarre sous la plus basse déjà
      // utilisée jusqu'ici (y compris par les aliquots précédents du même
      // passage) — elles s'empilent proprement en bas au lieu de se mélanger.
      // Pas de "+ 1" ici : les lignes normales et les lignes aliquots sont
      // dans des colonnes (x) différentes, donc partager exactement la même
      // rangée de départ ne provoque aucune collision — ça évite juste une
      // rangée vide inutile qui poussait l'aliquot trop bas visuellement.
      derivedLines.forEach(line => {
        const parentStep = line.smpl_workflow_line_fk ? this.getStep(line.smpl_workflow_step_fk) : null;
        positionLine(line, maxYUsed);
        // [link] diagnostic : l'écart vertical entre le step parent et le
        // premier step de son aliquot peut devenir très grand (maxYUsed est
        // partagé par TOUT le workflow, pas juste cette ligne) — utile pour
        // corréler avec le "bug d'affichage sur les points qui lient la ligne
        // principale et l'aliquot" (le connecteur setLinks() reste
        // mathématiquement correct mais peut visuellement paraître "cassé"
        // sur un écart démesuré).
        console.log(`[link] setVerticalPositions: aliquot ${line.id}(${line.smpl_label}) démarre à y=${line.steps[0]?.y} (maxYUsed=${maxYUsed}) — parent step ${parentStep?.id} à y=${parentStep?.y} — écart=${(line.steps[0]?.y ?? NaN) - (parentStep?.y ?? NaN)}`);
      });
    },
    
    aggregateSteps() {
      this.steps = [];

      this.workflow.batches.forEach(batch => {
        batch.active = false;
      });
      
      this.workflow.lines.filter(line => line.visible && line._matchesCaseTypeFilter !== false).forEach(line => {
        line.steps.forEach(step => {
          if (this.getEventTypeById(step.smpl_event_type_fk).smpl_label == "Collection" && this.currentEntities.subjects.length == 1 && this.currentEntities.cases.length == 1) {
            step.active = true;
          } else {
            step.active = false;
          }
          
          this.currentEntities.samples
            .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
            .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
            .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true)
            .forEach(sample => {
              if (step?.prevSteps.includes(sample.smpl_workflow_step_fk)) {
                if (step.smpl_workflow_step_batch_fk) this.getBatch(step.smpl_workflow_step_batch_fk).active = true;
                step.active = true;
              }
            });
            
          this.steps.push(step);
        });
      });
    },
    
    batchAlignment() {
      this.workflow.batches.forEach(batch => {
        const steps = this.steps.filter(step => step?.smpl_workflow_step_batch_fk == batch.id);
        var lowest = 0;
        steps.forEach(step => { lowest = Math.max(lowest, step.y); });
        batch.y = lowest;
        steps.forEach(step => { step.yBatch = batch.y; });
      });
      
      this.setVerticalPositions();
    },
    
    removeEmptyRows() {
      var rowCount = 0;
      this.steps.forEach(step => {
        rowCount = Math.max(rowCount, step.y);
      });
      
      var positions = Array(rowCount + 1).fill();
      this.steps.forEach(step => {
        if (!positions[step.y]) positions[step.y] = [step.id];
        else positions[step.y].push(step.id);
      });
      
      positions = positions.filter(d => d);

      positions.forEach((elements, index) => {
        if (elements) {
          elements.forEach(id => {
            var step = this.getStep(id);
            step.y = index;
            if (step?.smpl_workflow_step_batch_fk) {
              const batch = this.workflow.batches.find(batch => batch.id == step.smpl_workflow_step_batch_fk);
              batch.y = index;
            }
          });
        }
      });
    },
    
setLinks() {

  const lines = this.workflow.lines.filter(line => line.visible && line?._matchesCaseTypeFilter !== false && line?.steps.length > 0);
  this.links = [];
  
  
  let skippedLines = [];
  let createdLinks = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    
    // ✅ VÉRIFICATION : Au moins 2 steps
    if (!line.steps || line.steps.length < 2) {
      const warning = {
        lineId: line.id,
        label: line.smpl_label,
        stepsCount: line.steps?.length || 0,
        reason: 'Needs at least 2 steps to create links'
      };
      skippedLines.push(warning);
      continue;
    }
    
    var parentStep = line.smpl_workflow_line_fk
      ? this.getStep(line.smpl_workflow_step_fk)
      : { id: (this.workflow?.smpl_workflow_is_collection ? -1 : null), x: 0, y: 0 };

    // [link] diagnostic : une ligne dérivée (smpl_workflow_line_fk défini) dont
    // le step parent référencé (smpl_workflow_step_fk) n'existe plus/pas dans
    // ce rendu faisait planter TOUTE la fonction ici (parentStep.id sur
    // undefined) — donc aussi toutes les lignes suivantes du tableau, qui
    // perdaient leur lien sans aucune erreur visible. Symptôme parfaitement
    // "intermittent" : ne se produit que quand CETTE ligne précise est traitée
    // avec un step parent invalide. Remplacé par un skip + log au lieu de planter.
    if (line.smpl_workflow_line_fk && !parentStep) {
      console.error(`[link] setLinks: ligne ${line.id} (${line.smpl_label}) référence un step parent introuvable (smpl_workflow_step_fk=${line.smpl_workflow_step_fk}) — lien ignoré au lieu de planter.`);
      skippedLines.push({ lineId: line.id, label: line.smpl_label, reason: `parent step ${line.smpl_workflow_step_fk} not found` });
      continue;
    }

    if (parentStep.id) {
      const optionalOffset = 0.12;
      // Revenu à steps[1] (comportement d'origine) — l'hypothèse "connecteur
      // qui traverse steps[0]" n'était pas le vrai bug (voir 2.4.10 : le vrai
      // problème était l'indicateur "hide/show", visible seulement pour les
      // étapes de type "Aliquoting" au lieu de toute étape ayant une ligne
      // dérivée).
      const sampleStep = line.steps[1];

      // [link] diagnostic : si une ligne dérivée n'a qu'un seul step,
      // sampleStep est undefined et les 3 accès sampleStep.id/x/y plus bas
      // plantent (effet domino sur les lignes suivantes du tableau) — skip +
      // log au lieu de planter.
      if (!sampleStep) {
        console.error(`[link] setLinks: ligne ${line.id} (${line.smpl_label}) n'a pas de steps[1] (${line.steps.length} step(s) au total) — lien ignoré.`);
        skippedLines.push({ lineId: line.id, label: line.smpl_label, reason: 'missing steps[1]' });
        continue;
      }

      console.log(`[link] setLinks: ligne ${line.id}(${line.smpl_label}) parentStep=${parentStep.id}@(x=${parentStep.x},y=${parentStep.y}) sampleStep=${sampleStep.id}(${sampleStep.type},x=${sampleStep.x},y=${sampleStep.y})`);

      // Premier link
      this.links.push({
        id: (parentStep.id * 10000 + sampleStep.id) * 10,
        source: [((parentStep.x + (parentStep.smpl_workflow_step_is_optional ? optionalOffset : 0)) + 0.78 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
        target: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
        origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
        dashed: true
      });
      createdLinks++;
      
      if (this.workflow.smpl_workflow_show_hierarchy) {
        this.links.push({
          id: parentStep.id * 1000 + sampleStep.id,
          source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
          target: [sampleStep.x * this.grid.step[0], sampleStep.y * this.grid.step[1]],
          origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
          dashed: true
        });
        createdLinks++;
      } else {
        this.links.push({
          id: parentStep.id * 1000 + sampleStep.id,
          source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
          target: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], sampleStep.y * this.grid.step[1]],
          origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
          dashed: true
        });
        createdLinks++;
        
        this.links.push({
          id: parentStep.id * 100000 + sampleStep.id * 100,
          source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], sampleStep.y * this.grid.step[1]],
          target: [sampleStep.x * this.grid.step[0], sampleStep.y * this.grid.step[1]],
          origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
          dashed: true
        });
        createdLinks++;
      }
      
    }
  }

  // [link] diagnostic : détecter les collisions d'id entre liens de LIGNES
  // DIFFÉRENTES — la clé D3 utilisée par enterLinks() (d => d.id) traite deux
  // liens de même id comme le MÊME élément DOM ; l'un des deux "disparaît" ou
  // hérite de la position de l'autre selon l'ordre de traitement — symptôme
  // parfaitement intermittent puisqu'il ne dépend que des ids réels
  // (parentStep.id/sampleStep.id) présents dans CE workflow à CE moment.
  const idCounts = new Map();
  this.links.forEach(link => idCounts.set(link.id, (idCounts.get(link.id) || 0) + 1));
  const duplicateIds = [...idCounts.entries()].filter(([id, count]) => count > 1);
  if (duplicateIds.length > 0) {
    console.error("[link] setLinks: COLLISION D'ID détectée entre plusieurs liens (même id, éléments DOM confondus par D3 lors du data-join) :", duplicateIds);
  }

  console.log(`[link] setLinks: ${createdLinks} lien(s) créé(s) sur ${lines.length} ligne(s) visibles, ${skippedLines.length} ligne(s) ignorée(s)`, skippedLines);
},
    
    async updateCounts() {
      const tStart = performance.now();
      this.steps = [];

      this.workflow.lines.forEach(line => {
        line.steps.forEach(step => {
          this.steps.push(step);
        });
      });

      // smpl_get_sample_counts ne filtre PAS réellement côté serveur par
      // subject[]/casus[]/kit[] (même défaut que GET /entities?entitytype_id=X) :
      // il renvoie les comptes de TOUS les samples de l'étape, peu importe le
      // sujet/cas sélectionné. On récupère donc les samples bruts de toutes les
      // étapes en un seul appel (comme le fait déjà le bouton "all/none") et on
      // calcule nous-mêmes les comptes, correctement filtrés.
      const stepIds = this.steps.map(step => step.id);
      const tSamples = performance.now();
      const rawSamples = stepIds.length > 0 ? await this.getSamples(stepIds) : [];
      console.log(`[perf] updateCounts: getSamples(${stepIds.length} steps) took ${(performance.now() - tSamples).toFixed(0)}ms (${rawSamples.length} raw samples)`);

      let scopedSamples = rawSamples
        .filter(sample => this.currentEntities.subjects.length > 0 ? !!this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) : true)
        .filter(sample => this.currentEntities.cases.length > 0 ? !!this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) : true)
        .filter(sample => this.currentEntities.kits.length > 0 ? !!this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) : true);

      // Filtre "type de cas" du dropdown toolbar — voir filterSamplesByCaseType().
      // Sans ça, une ligne sans restriction Line_Case_Type_Quantity affichait/
      // comptait TOUS ses samples dès qu'aucun case/subject n'était sélectionné,
      // même en filtrant sur un type de cas précis dans le dropdown.
      scopedSamples = await this.filterSamplesByCaseType(scopedSamples);

      const selectedIds = new Set(this.currentEntities.samples.map(sample => sample.id));

      this.steps.forEach(step => {
        const byStatus = new Map();

        scopedSamples
          .filter(sample => sample.smpl_workflow_step_fk == step.id)
          .forEach(sample => {
            const statusId = sample.smpl_sample_status_fk;
            if (!byStatus.has(statusId)) {
              const status = this.workflow.statuses.find(s => s.id == statusId);
              byStatus.set(statusId, { count: 0, selected: 0, status });
            }
            const entry = byStatus.get(statusId);
            entry.count++;
            if (selectedIds.has(sample.id)) entry.selected++;
          });

        step.count = Array.from(byStatus.values());
        step.total = { count: 0, selected: 0 };
        step.count.forEach(c => {
          step.total.count += c.count;
          step.total.selected += c.selected;
        });
      });

      const tUpdate = performance.now();
      await this.update();
      console.log(`[perf] updateCounts: this.update() (positions/steps/links/toolbar DOM render) took ${(performance.now() - tUpdate).toFixed(0)}ms`);
      console.log(`[perf] updateCounts: TOTAL ${(performance.now() - tStart).toFixed(0)}ms`);
    },

    hideLine(id) {
      this.getLine(id).visible = false;
      this.workflow.lines.filter(line => line?.smpl_workflow_line_fk == id).forEach(subline => {
        this.hideLine(subline.id);
      });
    },
    
    //==========================
    // GESTION DU RENDU GRAPHIQUE
    //==========================
    
  async enterSteps() {
  // Cacher les sélections D3 fréquemment utilisées
  if (!this.d3Cache) {
    this.d3Cache = {
      nodeLayer: d3.select("#nodeLayer"),
      lineLayer: d3.select("#lineLayer"),
      batchLayer: d3.select("#batchLayer"),
      countLayer: d3.select("#countLayer")
    };
  } else {
    // Vérifier si le cache est périmé (DOM recréé après navigation)
    const nodeLayerNode = this.d3Cache.nodeLayer.node();
    const isAttached = nodeLayerNode ? document.body.contains(nodeLayerNode) : false;
    if (!isAttached) {
      this.d3Cache = {
        nodeLayer: d3.select("#nodeLayer"),
        lineLayer: d3.select("#lineLayer"),
        batchLayer: d3.select("#batchLayer"),
        countLayer: d3.select("#countLayer")
      };
    }
  }
  
  const steps = this.steps;
  const visibleLines = this.workflow.lines.filter(line => line.visible && line._matchesCaseTypeFilter !== false && line.steps?.length > 0);
  const optionalOffset = 0.12;
  
  // Fonction de wrapping de texte optimisée
  function wrap(text, width) {
    text.each(function() {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      const lineHeight = 1.1;
      const x = text.attr("x");
      const y = text.attr("y");
      let lineNumber = 0;
      let word;
      let line = [];
      
      let tspan = text.text(null)
        .append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", 0 + "em");
        
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node() && tspan.node().getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          
          if (lineNumber < 1) {
            tspan = text.append("tspan")
              .attr("x", x)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + "em")
              .text(word);
          } else {
            tspan.text(tspan.text() + "…");
            break;
          }
        }
      }
    });
  }

  // ======== LIGNES ÉCHANTILLONS ========
  // Utiliser une seule sélection et un chaînage de méthodes pour réduire les accès DOM
  const sampleLines = this.d3Cache.lineLayer.selectAll(".sampleLine")
    .data(visibleLines, d => d.id);
  
  // Supprimer les lignes obsolètes
  sampleLines.exit().remove();
  
  // Créer les nouvelles lignes
  const sampleLineEnter = sampleLines.enter()
    .append("g")
    .classed("sampleLine", true);

  // Texte de la ligne : "Nx Label" — la quantité affichée doit refléter le type de
  // cas actif (filtre dropdown ou cas réel sélectionné), pas juste la quantité par
  // défaut de la ligne, sinon changer de type de cas dans le dropdown ne montre
  // jamais rien visuellement tant que la ligne reste affichée des deux côtés.
  const lineLabelText = d => {
    const quantity = this.resolveLineQuantity(d);
    const displayQuantity = (quantity !== null && quantity !== undefined) ? quantity : d.smpl_workflow_line_quantity;
    return (displayQuantity ? displayQuantity + "× " : "") + (d.smpl_label ? d.smpl_label : "");
  };

  // Ajouter le texte des lignes
  sampleLineEnter.append("text")
    .attr("fill", "#041E42")
    .style("font-family", "'Urbanist', sans-serif")
    .style("text-anchor", "start")
    .style("font-size", "1.4em")
    .style("font-weight", 700)
    .style("cursor", "default")
    .attr('x', -10)
    .attr('y', d => (this.getLine(d.id).steps[0].y - 0.5) * this.grid.step[1])
    .text(lineLabelText)
    .call(wrap, this.grid.step[0] - 40);

  // Ajouter les lignes principales et de fin
  // Design 2.4.0 — bouts arrondis (linecap) au lieu de bouts carrés, plus doux.
  sampleLineEnter.append("line")
    .attr("class", "bigLine")
    .attr("stroke", d => {
      const color = this.getChoiceDescription(d.smpl_workflow_line_color);
      return color ? color : "#98A2B3";
    })
    .attr("stroke-width", 6)
    .style("stroke-linecap", "round");

  // Design 2.4.0 — fin de ligne en point plein (timeline moderne) au lieu
  // d'une barre perpendiculaire ; centré exactement sur le même point que
  // l'ancien x1/y1==x2/y2, donc pas de changement de géométrie.
  sampleLineEnter.append("circle")
    .attr("class", "endLine")
    .attr("r", 7)
    .style("fill", d => {
      const color = this.getChoiceDescription(d.smpl_workflow_line_color);
      return color ? color : "#98A2B3";
    })
    .style("stroke", "#FFFFFF")
    .style("stroke-width", 2);

  // Mettre à jour toutes les lignes (nouvelles et existantes)
  const sampleLineUpdate = sampleLines.merge(sampleLineEnter);
  
  sampleLineUpdate.transition()
    .duration(300)
    .attr("transform", d => {
      return "translate(" + (d.steps[0].x * this.grid.step[0]) + ",0)scale(1)";
    });

  sampleLineUpdate.select("text")
    .attr('x', -10)
    .attr('y', d => (this.getLine(d.id).steps[0].y - 0.5) * this.grid.step[1])
    .text(lineLabelText)
    .call(wrap, this.grid.step[0] - 40);

  sampleLineUpdate.select(".bigLine")
    .attr("x1", 0)
    .attr("y1", d => this.getLine(d.id).steps[0].y * this.grid.step[1])
    .attr("x2", 0)
    .attr("y2", d => {
      const steps = this.getLine(d.id).steps;
      const endStep = steps[steps.length - 1];
      return (endStep.y + 0.4) * this.grid.step[1];
    });
    
  sampleLineUpdate.select(".endLine")
    .attr("cx", 0)
    .attr("cy", d => {
      const steps = this.getLine(d.id).steps;
      const endStep = steps[steps.length - 1];
      return (endStep.y + 0.4) * this.grid.step[1];
    });

  // ======== ÉTAPES ========
  // Cache des dérivations (step parent -> ligne(s) dérivées via smpl_workflow_step_fk),
  // construit ICI (avant l'enter des nœuds) pour être disponible dès la visibilité
  // initiale du petit indicateur "hide/show" ci-dessous — voir commentaire sur
  // .classed("derivation", true) : une ligne dérivée peut partir de N'IMPORTE
  // QUEL type d'étape (Storage, une étape custom, etc.), pas seulement "Aliquoting".
  const derivationCache = {};
  this.workflow.lines.forEach(line => {
    if (line.smpl_workflow_step_fk) {
      if (!derivationCache[line.smpl_workflow_step_fk]) {
        derivationCache[line.smpl_workflow_step_fk] = [];
      }
      derivationCache[line.smpl_workflow_step_fk].push(line);
    }
  });

  const nodes = this.d3Cache.nodeLayer.selectAll(".node")
    .data(steps, d => d.id);
    
  // Supprimer les étapes obsolètes  
  nodes.exit().remove();
  
  // Créer les nouvelles étapes
  const nodesEnter = nodes.enter()
    .append("g")
    .attr("class", d => "n" + d.id)
    .classed("node", true)
    .style("opacity", 0);

  // Ajouter le chemin optionnel
  nodesEnter.append("path")
    .classed("optionalPath", true)
    .attr("d", d => "M " + (-optionalOffset * this.grid.step[0]) + ", -35 L 0, -35 L 0, 75, L " + (-optionalOffset * this.grid.step[0]) + ", 75")
    .style("fill", "none")
    .attr('stroke', d => {
      const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color);
      return color ? color : "#98A2B3";
    })
    .attr('stroke-width', 5)
    .style("stroke-dasharray", "5, 5")
    .style('opacity', 0);

  // Ajouter les dérivations
  // Visible dès qu'une ligne référence CETTE étape comme parent
  // (smpl_workflow_step_fk), peu importe le type de l'étape — corrigé depuis
  // `d.type == "Aliquoting"` qui cachait l'indicateur "hide/show" (et sa ligne
  // diagonale) pour toute dérivation partant d'une étape d'un autre type (ex:
  // Storage) : le gros connecteur en pointillés de setLinks() apparaissait
  // quand même (lui ne filtre pas par type), donnant un rendu incohérent —
  // dérivation visible sans aucune affordance pour la masquer/l'afficher.
  const derivation = nodesEnter.append("g")
    .classed("derivation", true)
    .style("visibility", d => (derivationCache[d.id]?.length > 0) ? "visible" : "hidden");
    
  derivation.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0.78 * this.grid.step[1])
    .attr("y2", 0.78 * this.grid.step[1])
    .attr('stroke', "#98A2B3")
    .attr('stroke-width', 3)
    .style("stroke-dasharray", "0, 6")
    .style('stroke-linecap', 'round');

  derivation.append("text")
    .style("font-size", "0.8em")
    .style("text-decoration", "underline")
    .style("cursor", "pointer")
    .attr("x", 0.78 * this.grid.step[1] + 2)
    .attr("y", 0.78 * this.grid.step[1] - 5)
    .on("click", (e, d) => {
      // Utiliser un index de lignes dérivées pour éviter des recherches répétées
      const derivedLines = this.workflow.lines.filter(line => line.smpl_workflow_step_fk == d.id);
      derivedLines.forEach(line => {
        if (line.visible) {
          d.open = false;
          this.hideLine(line.id);
        } else {
          d.open = true;
          line.visible = true;
        }
      });
      this.update();
    });

  // Ajouter les icônes d'entrée
  nodesEnter.append("path")
    .classed("inputIcon", true)
    .style("visibility", d => d.type == "Input" ? "visible" : "hidden")
    .attr("d", "M -14,-10 L 14,-10 L 0,10 Z")
    .attr("stroke", d => {
      const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color);
      return color ? color : "#98A2B3";
    })
    .attr('stroke-width', 4)
    .attr('fill', 'white');

  // Design 2.4.0 — halo derrière le badge d'étape, visible seulement si l'étape
  // est active (cliquable maintenant) : remplace l'ancien underline comme
  // affordance, plus visible et plus moderne. Ajouté AVANT .icon pour rester
  // dessous dans l'ordre de peinture SVG.
  nodesEnter.append("circle")
    .classed("activeGlow", true)
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 17)
    .style("pointer-events", "none");

  // Ajouter les cercles pour les icônes
  // Design 2.4.0 — rayon un peu plus grand + ombre douce (filtre défini dans
  // le <defs> du template) pour un badge plus "chip" moderne.
  nodesEnter.append("circle")
    .classed("icon", true)
    .style("visibility", d => ["Input"].includes(d.type) ? "hidden" : "visible")
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 13)
    .style("fill", "white")
    .style("filter", "url(#dd-soft-shadow)");

  // Ajouter les éléments de texte
  // Design 2.4.0 — "eyebrow" label (majuscules + espacement des lettres) au
  // lieu d'un texte brut, plus proche des conventions modernes de type/tag.
  nodesEnter.append("text")
    .classed("nodeType", true)
    .attr("fill", "#667085")
    .style("font-family", "'IBM Plex Sans', sans-serif")
    .style("text-anchor", "start")
    .style("font-size", "0.62em")
    .style("font-weight", "700")
    .style("text-transform", "uppercase")
    .style("letter-spacing", "0.04em")
    .style("cursor", "default")
    .attr('x', 22)
    .attr('y', -14);

  nodesEnter.append("text")
    .classed("nodeName", true)
    .attr("fill", "#041E42")
    .style("font-family", "'IBM Plex Sans', sans-serif")
    .style("text-anchor", "start")
    .style("font-weight", "700")
    .attr('x', 22)
    .attr('y', 7)
    .on("click", async (e, d) => {
      if (d.active) this.standardEvent(d);
    });

  nodesEnter.append("text")
    .classed("nodeId", true)
    .style("text-anchor", "start")
    .style("font-size", "0.5em")
    .style("cursor", "default")
    .attr("fill", "#98A2B3")
    .style("opacity", 0.5)
    .attr('x', 22)
    .attr('y', 21);

  nodesEnter.append("text")
    .classed("nodeThen", true)
    .attr("fill", "#041E42")
    .style("font-family", "'IBM Plex Sans', sans-serif")
    .style("text-anchor", "start")
    .style("font-size", "0.7em")
    .style("cursor", "default")
    .attr('x', 22)
    .attr('y', 41);

  // Mettre à jour toutes les étapes (nouvelles et existantes)
  const nodesUpdate = nodes.merge(nodesEnter).classed("active", d => d.active);

  // Mettre à jour les propriétés des étapes
  nodesUpdate.select(".optionalPath")
    .style("opacity", d => d.smpl_workflow_step_is_optional ? 1 : 0);

  nodesUpdate.select(".icon")
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 12)
    .attr("stroke", d => {
      const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color);
      return color ? color : "#98A2B3";
    })
    .attr('stroke-width', 4);

  // Design 2.4.0 — halo coloré (même couleur que la ligne) uniquement sur les
  // étapes actives/cliquables, avec une légère transition d'opacité.
  nodesUpdate.select(".activeGlow")
    .style("fill", d => {
      const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color);
      return color ? color : "#0072CE";
    })
    .transition()
    .duration(200)
    .style("opacity", d => d.active ? 0.18 : 0);

  nodesUpdate.selectAll('text')
    .attr("fill", d => d.active ? "#041E42" : "#667085");

  // Rafraîchit aussi la visibilité (pas seulement à l'enter) — derivationCache
  // est construit une fois en haut de cette fonction, avant l'enter des nœuds.
  nodesUpdate.select(".derivation")
    .style("visibility", d => (derivationCache[d.id]?.length > 0) ? "visible" : "hidden");

  nodesUpdate.select(".derivation")
    .select("text")
    .html(d => {
      // Utiliser le cache pour une recherche plus rapide
      const derivedLines = derivationCache[d.id] || [];
      const areVisible = derivedLines.length > 0 && derivedLines.every(line => line.visible);
      return areVisible ? "hide" : "show";
    });

  // Mettre à jour les types d'étapes
  nodesUpdate.select('.nodeType')
    .text(d => {
      if (d.smpl_label) {
        const eventType = this.getEventTypeByName(d.type);
        if (eventType && eventType.smpl_is_alias) {
          return "alias to " + d.smpl_workflow_step_goto_fk;
        } else {
          return d.type + (d.smpl_workflow_step_is_optional ? " (opt.)" : "");
        }
      }
      return "";
    });

  // Mettre à jour les noms d'étapes
  nodesUpdate.select('.nodeName')
    .style("cursor", d => d.active ? "pointer" : "default")
    .text(d => d.smpl_label ? d.smpl_label : d.type)
    .call(wrap, this.grid.step[0] - 40);

  // Mettre à jour les textes additionnels
  nodesUpdate.select('.nodeThen')
    .text(d => d.smpl_workflow_step_then ? "then: " + d.smpl_workflow_step_then : "")
    .call(wrap, this.grid.step[0] - 100);

  nodesUpdate.select('.nodeId')
    .text(d => d?.smpl_order + ": " + d.id);

  // Animer la transition des étapes
  nodesUpdate.transition()
    .duration(300)
    .attr("transform", d => {
      return "translate(" + ((d.x + (d.smpl_workflow_step_is_optional ? optionalOffset : 0)) * this.grid.step[0]) + "," + ((d.dragged ? d.fy : d.y) * this.grid.step[1]) + ")scale(1)";
    })
    .style("opacity", 1);

  // ======== LOTS ========
  const batches = this.d3Cache.batchLayer.selectAll(".batch")
    .data(this.workflow.batches, d => d.id);
  
  // Supprimer les lots obsolètes
  batches.exit().remove();
  
  // Créer les nouveaux lots
  const batchEnter = batches.enter()
    .append("g")
    .classed("batch", true)
    .style("opacity", 0);

  // Ajouter la ligne principale
  batchEnter.append('line')
    .attr('stroke', "#F2F4F7")
    .attr('stroke-width', 72)
    .attr("x1", d => (0.6) * this.grid.step[0])
    .attr("y1", d => d.y * this.grid.step[1])
    .attr("x2", d => (d.xMax + 1) * this.grid.step[0])
    .attr("y2", d => d.y * this.grid.step[1]);

  // Ajouter l'image
  batchEnter.append("image")
    .attr("xlink:href", this.resources.batch)
    .attr("width", 30)
    .attr("height", 30)
    .attr("x", 0.6 * this.grid.step[0] + 20)
    .attr("y", d => d.y * this.grid.step[1] - 15)
    .on("click", async (e, d) => {
      if (d.active) this.standardEvent(d);
    });

  // Mettre à jour tous les lots (nouveaux et existants)
  const batchUpdate = batches.merge(batchEnter);
  
  // Animer la transition des lots
  batchUpdate.transition()
    .duration(300)
    .style("opacity", 1);

  batchUpdate.select("image")
    .style("opacity", d => d?.active ? 0.8 : 0.3)
    .attr("y", d => d.y * this.grid.step[1] - 15)
    .style("cursor", d => d.active ? "pointer" : "default");

  batchUpdate.select("line")
    .attr("x1", d => (0.6) * this.grid.step[0])
    .attr("y1", d => d.y * this.grid.step[1])
    .attr("x2", d => (d.xMax + 1) * this.grid.step[0])
    .attr("y2", d => d.y * this.grid.step[1]);

  // ======== COMPTEURS ========
  // Ne sélectionner que les étapes avec des compteurs
  const stepsWithCounts = this.steps.filter(step => step.total.count > 0);
  
  // Supprimer d'abord les compteurs qui ne sont plus nécessaires
  const countIds = new Set(stepsWithCounts.map(step => "c" + step.id));
  this.d3Cache.countLayer.selectAll(".count").each(function() {
    const id = d3.select(this).attr("id");
    if (!countIds.has(id)) {
      d3.select(this).remove();
    }
  });
  
  // Ensuite, traiter individuellement chaque étape
  stepsWithCounts.forEach(step => {
    // Vérifier si le compteur existe déjà
    let countElement = this.d3Cache.countLayer.select("#c" + step.id);
    
    // Si le compteur n'existe pas, le créer
    if (countElement.empty()) {
      countElement = this.d3Cache.countLayer.append("g")
        .classed("count", true)
        .attr("id", "c" + step.id)
        .attr("transform", `translate(${step.x * this.grid.step[0]},${(step.y + 0.4 - 1) * this.grid.step[1]})`)
        .style("opacity", 1);
      
      // Ajouter les éléments de base du compteur
      countElement.append("rect").classed("countStatusBoxOutside", true)
        .attr("x", 0).attr("y", -3)
        .attr("width", 0).attr("height", 0)
        .attr("rx", 100).attr("ry", 100)
        .style("fill", "#475467")
        .style("fill-opacity", 0.0);
      
      countElement.append("rect").classed("countStatusBoxInside", true)
        .attr("x", 0).attr("y", -3)
        .attr("width", 0).attr("height", 0)
        .attr("rx", 100).attr("ry", 100)
        .style("fill", "#475467")
        .style("fill-opacity", 0.0);
      
      countElement.append("rect").classed("countValueBox", true)
        .attr("x", 0).attr("y", -3)
        .attr("width", 0).attr("height", 0)
        .attr("rx", 100).attr("ry", 100)
        .style("stroke", "#475467")
        .style("stroke-width", 3)
        .style("fill", "white")
        .style("fill-opacity", 0.0)
        .style("cursor", "pointer")
        .on("click", async () => {
          this.toBeSelected = [];
          await this.showCustomViewForStep(step.id);
        });
      
      countElement.append("text").classed("countValues", true)
        .attr("x", 0).attr("y", 0)
        .style("font-size", "0.8em")
        .style("fill", "#475467")
        .style("cursor", "pointer")
        .style("alignment-baseline", "middle");
    }
    
    // Mettre à jour la position du compteur
    countElement.transition()
      .duration(300)
      .attr("transform", `translate(${(step.x + (step.smpl_workflow_step_is_optional ? optionalOffset : 0)) * this.grid.step[0]},${(step.y + 0.45) * this.grid.step[1]})`);
    
    // Mettre à jour le contenu du compteur
    const text = countElement.select("text");
    text.html("");
    
    if (step.count && step.count.length > 0) {
      // Variables pour le positionnement
      let dy = 0.2 * 12;
      let lineHeight = 1.2 * 12;
      
      // Compteur principal
      text.append("tspan")
        .attr("x", 0)
        .attr("y", 0)
        .attr("dy", 0)
        .text(step.total.selected ? step.total.selected : step.total.count)
        .style("font-weight", 700)
        .style("font-size", "1.2em")
        .style("text-anchor", "middle")
        .style("alignment-baseline", "central")
        .on("click", async () => {
          this.toBeSelected = [];
          await this.showCustomViewForStep(step.id);
        });
      
      // Mesurer la taille du texte après le rendu
      const bbox = text.node().getBBox();
      
      // Texte d'information
      text.append("tspan")
        .attr("y", -3)
        .attr("x", 26 - bbox.x)
        .attr("dy", 0)
        .text(step.total.count + " SAMPLE" + (step.total.count > 1 ? "S" : "") + (step.total.selected ? " (" + step.total.selected + ")" : ""))
        .style("font-weight", 700)
        .style("font-size", "0.9em")
        .style("alignment-baseline", "central")
        .style("fill", "white")
        .on("mouseenter", function() {
          d3.select(this).style("text-decoration", "underline");
        })
        .on("mouseleave", function() {
          d3.select(this).style("text-decoration", "none");
        })
        .on("click", async () => {
          this.toBeSelected = [];
          await this.showCustomViewForStep(step.id);
        });
      
      // Bouton "all/none"
      const allNoneButton = text.append("tspan")
        .attr("y", -3)
        .attr("x", this.grid.step[0] * 0.5 + 10)
        .attr("dy", 0)
        .text(step.total.selected == step.total.count ? "none" : "all")
        .style("opacity", 0.5)
        .style("font-size", "0.6em")
        .style("text-anchor", "end")
        .style("alignment-baseline", "central")
        .style("fill", "white")
        .on("mouseenter", function() {
          d3.select(this).style("text-decoration", "underline");
        })
        .on("mouseleave", function() {
          d3.select(this).style("text-decoration", "none");
        })
       // Dans la fonction qui ajoute le bouton "all" principal
.on("click", async (e) => {
  // Capturer le bouton pour les mises à jour sécurisées
  const button = d3.select(e.target);
  
  try {
    // Désactiver les interactions pendant le traitement
    button.text("...").style("pointer-events", "none");

    // Obtenir les échantillons filtrés par le contexte actuel (subject/case/kit)
    const rawSamples = await this.getSamples([step.id]);
    let samples = rawSamples
      .filter(s => this.currentEntities.subjects.length > 0 ? !!this.currentEntities.subjects.find(sub => sub.id == s.smpl_subject_fk) : true)
      .filter(s => this.currentEntities.cases.length > 0 ? !!this.currentEntities.cases.find(cas => cas.id == s.smpl_case_fk) : true)
      .filter(s => this.currentEntities.kits.length > 0 ? !!this.currentEntities.kits.find(kit => kit.id == s.smpl_kit_fk) : true);
    // Même filtre "type de cas" que updateCounts() (voir filterSamplesByCaseType) —
    // sinon "all" sélectionnerait plus de samples que ce que le compteur affiche.
    samples = await this.filterSamplesByCaseType(samples);

    // Déterminer si on doit sélectionner tous ou désélectionner tous
    const shouldSelectAll = step.total.selected < step.total.count;

    if (shouldSelectAll) {
      // Sélectionner tous les échantillons
      this.selectSamples(samples);
    } else {
      // Désélectionner tous les échantillons de cette étape
      const currentlySelectedSamples = this.currentEntities.samples
        .filter(sample => sample.smpl_workflow_step_fk === step.id);
      this.unselectSamples(currentlySelectedSamples);
    }
    
    // Mettre à jour l'interface de manière optimiste
    if (shouldSelectAll) {
      // Mettre à jour tous les statuts individuels
      if (step.count) {
        step.count.forEach(c => {
          c.selected = c.count;
        });
      }
      // Mettre à jour le compteur total
      step.total.selected = step.total.count;
    } else {
      // Mettre à jour tous les statuts individuels
      if (step.count) {
        step.count.forEach(c => {
          c.selected = 0;
        });
      }
      // Mettre à jour le compteur total
      step.total.selected = 0;
    }
    
    // Mettre à jour l'interface
    this.updateCountersOnly();
    
  } catch (error) {
    this.updateCountersOnly();
  } finally {
    // Vérifier que le bouton existe encore
    if (button.node()) {
      button.text(step.total.selected === step.total.count ? "none" : "all")
        .style("pointer-events", "auto");
    }
  }
});
      
      // Ajouter les statuts individuels
      step.count.forEach(status => {
        dy += lineHeight;
        
        // Texte du statut
        text.append("tspan")
          .attr("x", 26 - bbox.x)
          .attr("dx", 0)
          .attr("y", dy - 3)
          .text(status.count + " " + status.status.smpl_label.toLowerCase() + (status.selected ? " (" + status.selected + ")" : ""))
          .style("font-weight", 500)
          .style("font-size", "0.8em")
          .style("alignment-baseline", "central")
          .style("fill", "dimgrey")
          .on("mouseenter", function() {
            d3.select(this).style("text-decoration", "underline");
          })
          .on("mouseleave", function() {
            d3.select(this).style("text-decoration", "none");
          })
          .on("click", async () => {
            this.toBeSelected = [];
            await this.showCustomViewForStep(step.id, status.status.id);
          });
        
        // Bouton "all/none" pour ce statut
        text.append("tspan")
          .attr("x", this.grid.step[0] * 0.5 + 10)
          .attr("y", dy - 3)
          .text(status.selected == status.count ? "none" : "all")
          .style("font-weight", 500)
          .style("opacity", 0.4)
          .style("font-size", "0.6em")
          .style("text-anchor", "end")
          .style("alignment-baseline", "central")
          .on("mouseenter", function() {
            d3.select(this).style("text-decoration", "underline");
          })
          .on("mouseleave", function() {
            d3.select(this).style("text-decoration", "none");
          })
          .on("click", async (e) => {
            const button = d3.select(e.target);
            button.text("...");
            button.style("pointer-events", "none");
            
            try {
              const samples = await this.getSamples([step.id]);
              let statusSamples = samples.filter(sample => sample.smpl_sample_status_fk == status.status.id);
              // Même filtre "type de cas" que updateCounts() (voir filterSamplesByCaseType).
              statusSamples = await this.filterSamplesByCaseType(statusSamples);

              if (status.selected == status.count) {
                this.unselectSamples(statusSamples);
              } else {
                this.selectSamples(statusSamples);
              }
            } catch (error) {
            } finally {
              if (button.node()) {
                button.text(status.selected == status.count ? "none" : "all");
                button.style("pointer-events", "auto");
              }
            }
          });
      });
      
      // Mettre à jour les dimensions des rectangles de fond
      const updatedBbox = text.node().getBBox();
      const r = 12;
      const width = Math.max(2 * (r - bbox.x - 6), 2 * r);
      
      countElement.select(".countValueBox")
        .style("fill-opacity", 1)
        .transition()
        .duration(200)
        .attr("x", -width / 2)
        .attr("y", -r)
        .attr("width", width)
        .attr("height", 2 * r)
        .attr("rx", r)
        .attr("ry", r)
        .style("fill", step.total.selected ? "#FFFAC4" : "white");
      
      countElement.select(".countStatusBoxOutside")
        .style("fill-opacity", 1)
        .transition()
        .duration(200)
        .attr("x", 20)
        .attr("y", -13)
        .attr("width", this.grid.step[0] * 0.5)
        .attr("height", updatedBbox.height + updatedBbox.y + 18)
        .attr("rx", 6)
        .attr("ry", 6)
        .style("fill", "#475467");
      
      const csboWeight = 2;
      const firstline = 1.2 * 16;
      
      countElement.select(".countStatusBoxInside")
        .style("fill-opacity", 1)
        .transition()
        .duration(200)
        .attr("x", 20 + csboWeight)
        .attr("y", -13 + firstline)
        .attr("width", this.grid.step[0] * 0.5 - 2 * csboWeight)
        .attr("height", updatedBbox.height + updatedBbox.y + 18 - firstline - csboWeight)
        .attr("rx", 3)
        .attr("ry", 3)
        .style("fill", "white");
    }
  });
},

// Méthode auxiliaire pour mettre à jour uniquement les compteurs
updateCountersOnly() {
  // Ne mettre à jour que les compteurs visibles
  this.steps.filter(step => step && step.total && step.total.count > 0).forEach(step => {
    const countElement = d3.select("#c" + step.id);
    if (countElement.empty()) return;
    
    // Mettre à jour le texte du compteur principal
    const mainCounter = countElement.select("text tspan:first-child");
    if (!mainCounter.empty()) {
      mainCounter.text(step.total.selected ? step.total.selected : step.total.count);
    }
    
    // Mettre à jour la couleur de la boîte de compteur
    const countBox = countElement.select(".countValueBox");
    if (!countBox.empty()) {
      countBox.style("fill", step.total.selected ? "#FFFAC4" : "white");
    }
    
    // Mettre à jour le texte récapitulatif
    const summaryText = countElement.select("text tspan:nth-child(2)");
    if (!summaryText.empty()) {
      summaryText.text(step.total.count + " SAMPLE" + 
        (step.total.count > 1 ? "S" : "") + 
        (step.total.selected ? " (" + step.total.selected + ")" : ""));
    }
    
    // Mettre à jour le bouton all/none
    const allNoneButton = countElement.select("text tspan:nth-child(3)");
    if (!allNoneButton.empty()) {
      allNoneButton.text(step.total && step.total.selected == step.total.count ? "none" : "all");
    }
  });
},
    
    enterLinks() {
      // [link] diagnostic : un lien avec une coordonnée NaN (source/target/origin)
      // ne lève aucune erreur — le <line> SVG correspondant s'affiche juste avec
      // des attributs invalides (souvent invisible ou en position aberrante),
      // ce qui ressemble exactement à des "points" de connexion manquants ou
      // mal placés de façon intermittente.
      const nanLinks = this.links.filter(l =>
        [...l.source, ...l.target, ...l.origin].some(v => typeof v !== 'number' || Number.isNaN(v))
      );
      if (nanLinks.length > 0) {
        console.error('[link] enterLinks: lien(s) avec une coordonnée NaN/non-numérique détecté(s) :', nanLinks);
      }

      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id).exit().remove();

      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id).enter()
        .append("line").classed("link", true)
        .style("stroke-dasharray", "0, 6")
        .style('stroke-linecap', 'round')
        .attr('stroke', "#98A2B3")
        .attr('stroke-width', 3)
        .attr("x1", d => d.origin[0])
        .attr("y1", d => d.origin[1])
        .attr("x2", d => d.origin[0])
        .attr("y2", d => d.origin[1]);

      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id)
        .transition()
        .style("opacity", 1)
        .attr("x1", d => d.source[0])
        .attr("y1", d => d.source[1])
        .attr("x2", d => d.target[0])
        .attr("y2", d => d.target[1]);
    },
    
    async enterToolbar() {
      const toolbar = d3.select("#toolbar");
      toolbar.html("");

      // Retiré ICI, avant même de savoir si le groupe "Case type" sera rendu —
      // sinon un popup resterait orphelin dans <body> si on bascule vers un
      // workflow sans Line_Case_Type_Quantity pendant qu'il était ouvert (le
      // bloc plus bas, où il était retiré avant, ne s'exécute alors plus du tout).
      d3.select('#dd-casetype-portal').remove();

      // Groupe workflow — remplace l'ancien <select id="wfSelector"> par un
      // déclencheur de side bar (même principe que smpl config).
      const workflowGroup = toolbar.append("div").attr("class", "toolbarGroup");
      workflowGroup.append("div").attr("class", "toolbarCurrentWorkflow")
        .style("cursor", "pointer")
        .text(this.workflow ? `${this.workflow.study}: ${this.workflow.smpl_label}` : '')
        .on("click", () => { this.sidebarCollapsed = false; });

      // Groupe filtre "type de cas" — n'apparaît que si ce workflow utilise
      // réellement Line_Case_Type_Quantity (sinon rien à filtrer, pas de bruit dans la toolbar).
      // caseTypeFilterOptions n'est PAS scopé par workflow (tous les SMPL_CASE_TYPE
      // du système) donc ça seul ne suffit pas : il faut en plus qu'AU MOINS une
      // ligne de CE workflow ait effectivement des Line_Case_Type_Quantity (i.e.
      // sa case "Case type available" est cochée), sinon le dropdown apparaît
      // pour des workflows qui n'utilisent pas du tout cette fonctionnalité.
      const workflowHasCaseTypeLines = this.workflow.lines.some(line => (line.caseTypeQuantities || []).length > 0);
      if (this.caseTypeFilterOptions.length > 0 && workflowHasCaseTypeLines) {
        const caseTypeFilterGroup = toolbar.append("div").attr("class", "toolbarGroup");
        // Menu custom (pas un <select multiple> natif) : la plateforme applique
        // son propre CSS/JS à TOUS les <select> de la page, ce qui rendait le
        // multi-select natif moche et impossible à utiliser (impossible de
        // cocher plusieurs options — voir capture d'écran). Un menu en div,
        // entièrement sous notre contrôle, contourne ce conflit.
        const caseTypeFilterElement = caseTypeFilterGroup.append("div").attr("class", "toolbarElement dd-casetype-wrapper");

        // _matchesCaseTypeFilter a déjà été rafraîchi en tout début d'update() —
        // on récupère juste la liste effective pour cocher les bonnes options et
        // composer le résumé affiché sur le déclencheur. Ce menu se reconstruit
        // à chaque enterToolbar(), lui-même appelé en fin de update() — donc à
        // chaque sélection/désélection de case (même plusieurs à la fois), les
        // options cochées ici sont automatiquement remises à jour pour refléter
        // les types de TOUS les cases sélectionnés.
        const effectiveCaseTypeFilters = this.getEffectiveCaseTypeFilters();
        const caseTypeSummary = effectiveCaseTypeFilters.length === 0
          ? "All case types"
          : effectiveCaseTypeFilters.length === 1
            ? (this.caseTypeFilterOptions.find(o => o.id == effectiveCaseTypeFilters[0])?.label || "1 selected")
            : `${effectiveCaseTypeFilters.length} selected`;

        caseTypeFilterElement.append("label").html("Case type");
        const caseTypeTrigger = caseTypeFilterElement.append("div")
          .attr("class", "dd-casetype-trigger")
          .text(caseTypeSummary + (this.caseTypeDropdownOpen ? " ▴" : " ▾"))
          .on("click", (e) => this.toggleCaseTypeDropdown(e));

        // Le popup n'est JAMAIS un enfant du toolbar (voir commentaire CSS
        // .dd-casetype-popup) : injecté directement dans <body>, positionné en
        // fixed via le rectangle réel du déclencheur (celui-ci vient d'être
        // retiré et recréé plus haut, sa position est donc à jour). Se
        // réaligne tout seul sur le déclencheur à chaque reconstruction du
        // toolbar (donc à chaque case cochée/décochée).
        if (this.caseTypeDropdownOpen) {
          const triggerRect = caseTypeTrigger.node().getBoundingClientRect();
          const popup = d3.select(document.body).append("div")
            .attr("id", "dd-casetype-portal")
            .attr("class", "dd-casetype-popup")
            .style("position", "fixed")
            .style("top", `${triggerRect.bottom + 4}px`)
            .style("left", `${triggerRect.left}px`);

          const allRow = popup.append("label").attr("class", "dd-casetype-option");
          allRow.append("input")
            .attr("type", "checkbox")
            .property("checked", effectiveCaseTypeFilters.length === 0)
            .on("change", () => {
              this.selectedCaseTypeFilter = 'ALL';
              // updateCounts() (pas update() seul) : c'est elle qui appelle
              // filterSamplesByCaseType() pour refiltrer les samples/compteurs
              // affichés selon le nouveau filtre — update() seul ne recalculait
              // que la visibilité des LIGNES (via applyCaseTypeFilter), jamais
              // les samples réellement comptés/affichés dans chaque étape.
              // update() est de toute façon appelée à la fin de updateCounts().
              this.updateCounts();
            });
          allRow.append("span").text("All case types");

          this.caseTypeFilterOptions.forEach(option => {
            const row = popup.append("label").attr("class", "dd-casetype-option");
            row.append("input")
              .attr("type", "checkbox")
              .property("checked", effectiveCaseTypeFilters.some(f => f == option.id))
              .on("change", () => {
                // Repart de l'état AFFICHÉ (auto-suivi inclus, pas seulement d'une
                // sélection déjà explicite) : cocher/décocher une case part de ce
                // qui est déjà visuellement coché, comme n'importe quelle checklist.
                const current = this.getEffectiveCaseTypeFilters();
                const isChecked = current.some(f => f == option.id);
                const next = isChecked ? current.filter(f => f != option.id) : [...current, option.id];
                this.selectedCaseTypeFilter = next.length === 0 ? 'ALL' : next;
                // Voir commentaire sur le handler "All case types" ci-dessus.
                this.updateCounts();
              });
            row.append("span").text(option.label);
          });
        }
      }

      // Groupe cas
      const caseGroup = toolbar.append("div").attr("class", "toolbarGroup");

      const subjectSelector = caseGroup.append("div").attr("class", "toolbarElement");
      subjectSelector.append("label").html("Subject");

      subjectSelector.append("button")
        .style("min-width", "120px")
        .style("max-width", "160px")
        .style("overflow", "hidden")
        .style("text-overflow", "ellipsis")
        .style("white-space", "nowrap")
        .html(() => {
          if (this.currentEntities.subjects.length == 1) return this.currentEntities.subjects[0].smpl_subject_id || this.currentEntities.subjects[0].smpl_id || this.currentEntities.subjects[0].id;
          else if (this.currentEntities.subjects.length > 1) return "Multiple";
          return "Select subject";
        }).on("click", (e) => {
          this.showCustomViewForSubjects();
        });

      if (this.usesCases) {
        const caseTranslation = this.$translate('field', 'label', this.getFieldByName('smpl_case_fk'));

        const caseSelector = caseGroup.append("div").attr("class", "toolbarElement");

        caseSelector.append("label").html(caseTranslation);

        caseSelector.append("button")
          .style("min-width", "120px")
          .style("max-width", "160px")
          .style("overflow", "hidden")
          .style("text-overflow", "ellipsis")
          .style("white-space", "nowrap")
          .html(() => {
            if (this.currentEntities.cases.length == 1) return this.currentEntities.cases[0].smpl_case_date || this.currentEntities.cases[0].smpl_case_id || this.currentEntities.cases[0].id;
            else if (this.currentEntities.cases.length > 1) return "Multiple";
            return "Select case";
          }).on("click", (e) => {
            this.showCustomViewForCases();
          });
      }

      if (this.workflow.smpl_workflow_uses_kits) {
        caseGroup.append("a").html("Kit").on("click", (e) => {
          this.showCustomViewForKits();
        });
      }

      // Groupe scanner
      const scannerGroup = toolbar.append("div").attr("class", "toolbarGroup");
      scannerGroup.append("input").attr("id", "scanField").attr("type", "text").attr("name", "scanner").attr("placeholder", "Scan")
        .on("change", async e => {
          await this.scan(e.target.value);
          document.getElementById('scanField').value = "";
        });
      // Groupe auxiliaire
      const auxGroup = toolbar.append("div").attr("class", "toolbarGroup");

      auxGroup.append("a")
        .classed("visible", d => {
          let flag = true;
          this.workflow.lines.forEach(line => {
            if (!line.visible) flag = false;
          });
          return flag;
        })
        .style("background-image", d => {
          let flag = true;
          this.workflow.lines.forEach(line => {
            if (!line.visible) flag = false;
          });
          return flag ? "url(" + this.resources.branches_hide + ")" : "url(" + this.resources.branches_show + ")";
        })
        .on("click", async (e, d) => {
          let flag = false;
          this.workflow.lines.forEach(line => {
            if (!line.visible) flag = true;
          });

          this.workflow.lines
            .filter(line => line.smpl_workflow_line_fk)
            .forEach(line => {
              line.visible = flag;
            });

          // Mettre à jour les propriétés 'open' des steps
          this.steps.forEach(step => {
            const derivedLines = this.workflow.lines.filter(line => line.smpl_workflow_step_fk == step.id);
            if (derivedLines.length > 0) {
              step.open = derivedLines.every(line => line.visible);
            }
          });

          this.updateCounts();
        });

      // Groupe droite : Lookup + logo SBP
      const rightGroup = toolbar.append("div").attr("class", "toolbarGroup")
        .style("margin-left", "auto")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "12px");

      rightGroup.append("a")
        .text("Lookup")
        .style("cursor", "pointer")
        .style("color", "#0D69D4")
        .style("font-weight", "bold")
        .style("white-space", "nowrap")
        .on("click", () => this.openLookupPopup());

      rightGroup.append("img").classed("smpllogo", true)
        .attr("src", this.resources["SMPL_logo_2"]);
    },
    
    // Mise à jour globale
    async update() {
      // "×" cliquable pour désélectionner subject/case sans repasser par le picker —
      // en tspan à l'intérieur du texte existant (pas un élément séparé) pour ne pas
      // avoir à recalculer sa position selon la longueur variable du label affiché.
      // Désélectionner le subject désélectionne aussi le case (un case appartient à
      // un subject), comme le fait déjà selectSubjects() ailleurs dans ce fichier.
      d3.select("#bonhommeSubject").html(this.currentEntities.subjects.length > 0
        ? "Subject: " + (this.currentEntities.subjects.length > 1 ? "Multiple" : (this.currentEntities.subjects[0]?.smpl_subject_id || this.currentEntities.subjects[0]?.smpl_id || this.currentEntities.subjects[0]?.id)) + ' <tspan id="bonhommeSubjectClear" style="cursor:pointer;">✕</tspan>'
        : "No subject selected");
      if (this.currentEntities.subjects.length > 0) {
        d3.select("#bonhommeSubjectClear").on("click", (e) => {
          e.stopPropagation();
          this.currentEntities.subjects = [];
          this.currentEntities.cases = [];
          this.updateCounts();
        });
      }

      if (this.usesCases) {
        d3.select("#bonhommeCase").html(this.currentEntities.cases.length > 0
          ? "Case: " + (this.currentEntities.cases.length > 1 ? "Multiple" : (this.currentEntities.cases[0]?.smpl_case_date || this.currentEntities.cases[0]?.smpl_case_id || this.currentEntities.cases[0]?.id)) + ' <tspan id="bonhommeCaseClear" style="cursor:pointer;">✕</tspan>'
          : "No case selected");
        if (this.currentEntities.cases.length > 0) {
          d3.select("#bonhommeCaseClear").on("click", (e) => {
            e.stopPropagation();
            this.currentEntities.cases = [];
            this.updateCounts();
          });
        }
      }

      const selectedContainers = this.currentEntities.samples
        .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
        .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
        .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true)
        .filter(sample => sample.smpl_sample_status_fk == this.getStatusId("Dispatched"));
        
      d3.select("#bonhommeContainers").html(selectedContainers?.length ? "Use selected containers (" + selectedContainers.length + ")" : "Use new containers");
      
      // Si le workflow n'utilise pas les cas, on considère l'étape "case" comme
      // déjà satisfaite (1 au lieu de la vraie longueur) pour sauter tout droit
      // à "Batch collection" — la branche "New case" ne peut alors plus matcher.
      const effectiveCaseCount = this.usesCases ? this.currentEntities.cases.length : 1;

      d3.select("#bonhommeCollect")
        .classed("active", () => {
          if (this.currentEntities.subjects.length == 0)
            return true;
          else if (this.currentEntities.subjects.length == 1 && effectiveCaseCount == 0)
            return true;
          else if (this.currentEntities.subjects.length == 1 && effectiveCaseCount == 1)
            return true;
          return false;
        })
        .text(() => {
          if (this.currentEntities.subjects.length == 0)
            return "New subject";
          else if (this.currentEntities.subjects.length == 1 && effectiveCaseCount == 0)
            return "New case";
          else if (this.currentEntities.subjects.length == 1 && effectiveCaseCount == 1)
            return "Batch collection";
        });

      // Doit tourner AVANT setHorizontalPositions/setVerticalPositions/enterSteps
      // etc. ci-dessous : ce sont elles qui filtrent les lignes via
      // _matchesCaseTypeFilter, donc si on ne le rafraîchit qu'après (dans
      // enterToolbar plus bas) elles utilisent encore la valeur du rendu
      // précédent — le filtre semble alors "en retard" d'un cran, en particulier
      // quand on vient de changer de case (le dropdown suit automatiquement le
      // type de cas du case sélectionné).
      this.applyCaseTypeFilter();

      this.setHorizontalPositions();
      this.setVerticalPositions();
      this.aggregateSteps();
      
      // Alignement des lots et suppression des lignes vides
      for (var i = 0; i < 15; i++) this.batchAlignment();
      this.removeEmptyRows();
      this.setVerticalPositions();
      for (var i = 0; i < 15; i++) this.batchAlignment();
      this.removeEmptyRows();
      
      // Configuration des liens et affichage
      this.setLinks();
      this.enterSteps();
      this.enterLinks();
      this.enterToolbar();
    },

    //==========================
    // GESTION DES FORMULAIRES
    //==========================
    


async loadForms() {
  this.changedFormValues = {};
  
  try {
    this.displayForms = true;
    const now = Date.now();
    
    // Utiliser Promise.all pour charger tous les formulaires en parallèle
    const formPromises = this.forms.map(async form => {
      // Vérifier si le formulaire est dans le cache et si le cache est encore valide
      const cachedTime = this.formCacheTimestamps.get(form.id);
      
      if (cachedTime && now - cachedTime < this.formCacheTTL) {
        // Utiliser la version en cache
        form.form = this.formCache.get(form.id);
      } else {
        // Récupérer le formulaire depuis le serveur
        form.form = await this.dapp.$store.dispatch('forms/fetchForm', form.id);
        
        // Mettre en cache
        this.formCache.set(form.id, form.form);
        this.formCacheTimestamps.set(form.id, now);
      }
      
      return form;
    });
    
    // Attendre que tous les formulaires soient chargés
    await Promise.all(formPromises);
  } catch (error) {
    this.exceptionHandler(error);
  } finally {
    this.loading = false;
  }
},

// Méthode pour invalider manuellement le cache des formulaires
clearFormCache() {
  this.formCache.clear();
  this.formCacheTimestamps.clear();
},

// Méthode pour invalider un formulaire spécifique
invalidateFormCache(formId) {
  this.formCache.delete(formId);
  this.formCacheTimestamps.delete(formId);
},
    
    changedValue(e, form) {
      const prev = typeof this.changedFormValues[form.id]?.e === "object" ? this.changedFormValues[form.id].e : {};
      const accumulated = Object.assign({}, prev, typeof e === "object" ? e : {});
      this.changedFormValues[form.id] = { "form": form, "e": accumulated };
    },
    
    async updateId() {
      for (const [formId, value] of Object.entries(this.changedFormValues)) {
        const form = value.form;
        const e = value.e;

        // Skip forms without an ID template (e.g. event forms) — mutating
        // defaultEntity for those triggers a re-render that resets static values
        if (!form?.template) {
          continue;
        }

        // Build entity for ID generation without mutating form.defaultEntity
        const entityForId = e?.smpl_id
          ? { ...form.defaultEntity }
          : Object.assign({}, form.defaultEntity, e || {});

        const idAssembly = await this.dapp.$axios.$post(
          await this.getRouteURLByName('smpl_generate_id'),
          { entity: entityForId, template: form.template }
        );

        // Only patch ID fields (minimal mutation → minimal re-render)
        form.defaultEntity.smpl_id_stem = idAssembly.stem || "undefined";
        form.defaultEntity.smpl_id_nb = idAssembly.nb;
        form.defaultEntity.smpl_id = idAssembly.id;
      }
    },
    
    async formSubmitted(form) {
      form.submitted = true;
      
      
      if (this.forms.every(form => form.submitted)) {
        this.$toastNotifier.notifySuccess('Form submited successfully');
        this.displayForms = false;
        await this.formDispatch();
      }
    },
    
    async submit() {
      await this.updateId();
      
      if (this.loadedForms) {
       
        
        for (let i = 0; i < this.forms.length; i++) {
          const form = this.forms[i];
          this.$refs[`formRendering${i + "" + form.id}`][0].submit();
          form.isValidForm = this.$refs[`formRendering${i + "" + form.id}`][0].isValidForm;
        }
        
        return true;
      }
      
      return false;
    },
    
    async popPipeline() {
      if (this.pipeline.length > 0) {
        this.forms = this.pipeline.pop();
        
        this.displayForms = false;
        await this.loadForms();
      }
      else {
        this.forms = [];
        
        if (this.collectionOngoing) {
          this.showCustomViewAfterSampleCreation(this.ongoingCollectionFk);
          this.collectionOngoing = false;
          this.ongoingCollectionFk = null;
        }
      }
    },

    //==========================
    // GESTION DES ENTITÉS
    //==========================
    
    selectSamplesOptimistically(step, status) {
      // Get the current status count info
      const statusInfo = status ? 
        step.count.find(c => c.status.id === status.id) : 
        { count: step.total.count, selected: step.total.selected };
      
      if (!statusInfo) return;
      
      const currentlySelected = statusInfo.selected;
      const totalCount = statusInfo.count;
      
      // Determine if we're selecting all or deselecting all
      const isSelectingAll = currentlySelected < totalCount;
      
      // Optimistically update the UI counts
      if (status) {
        // Update specific status count
        const statusCount = step.count.find(c => c.status.id === status.id);
        if (statusCount) {
          statusCount.selected = isSelectingAll ? statusCount.count : 0;
        }
      } else {
        // Update all status counts for this step
        if (step.count) {
          step.count.forEach(c => {
            c.selected = isSelectingAll ? c.count : 0;
          });
        }
      }
      
      // Update total count
      step.total.selected = isSelectingAll ? step.total.count : 0;
      
      // Return whether we're selecting or deselecting
      return isSelectingAll;
    },
    
    selectSamples(samples) {
      if (!samples || samples.length === 0) return;

      // Créer un Set des IDs d'échantillons déjà sélectionnés pour une recherche O(1)
      const existingIds = new Set(this.currentEntities.samples.map(s => s.id));

      // Filtrer uniquement les nouveaux échantillons
      const newSamples = samples.filter(sample => !existingIds.has(sample.id));

      // Ajouter en bloc
      if (newSamples.length > 0) {
        this.currentEntities.samples = [...this.currentEntities.samples, ...newSamples];
        // Déclencher updateCounts une seule fois à la fin
        this.$nextTick(() => this.updateCounts());
      }
    },
    
    unselectSamples(samples) {
      if (!samples) {
        this.currentEntities.samples = [];
        this.updateCounts();
        return;
      }
      
      for (let i = this.currentEntities.samples.length - 1; i >= 0; i--) {
        const found = samples.find(sample => sample.id == this.currentEntities.samples[i].id);
        if (found) this.currentEntities.samples.splice(i, 1);
      }
      
      this.updateCounts();
    },
    
    unselectSampleIds(ids) {
      if (!ids) {
        this.currentEntities.samples = [];
        this.updateCounts();
        return;
      }
      
      for (let i = this.currentEntities.samples.length - 1; i >= 0; i--) {
        const found = ids.find(id => id == this.currentEntities.samples[i].id);
        if (found) this.currentEntities.samples.splice(i, 1);
      }
      
      this.updateCounts();
    },
    
    selectSubjects(subjects, toBeUnselectedIds = []) {
      this.currentEntities.subjects = this.currentEntities.subjects.filter(subject => !toBeUnselectedIds.includes(subject.id));
      this.currentEntities.cases = this.currentEntities.cases.filter(casus => !toBeUnselectedIds.includes(casus.smpl_subject_fk));
      
      if (subjects) {
        this.currentEntities.subjects = subjects;
        this.updateCounts();
      }
    },
    
    async selectCases(cases, toBeUnselectedIds = []) {
      this.currentEntities.cases = this.currentEntities.cases.filter(casus => !toBeUnselectedIds.includes(casus.id));

      if (cases) {
        // Refetch depuis le serveur pour garantir l'id DB sur chaque case
        let fetchedCases = [];
        for (const casus of cases) {
          if (casus?.id) {
            const fetched = await this.getEntity(casus.id);
            fetchedCases.push(fetched || casus);
          } else {
            fetchedCases.push(casus);
          }
        }
        this.currentEntities.cases = fetchedCases;

        let subjectIds = [];
        fetchedCases.forEach(casus => {
          if (casus?.smpl_subject_fk) subjectIds.push(casus.smpl_subject_fk);
        });

        if (subjectIds.length > 0) {
          let subjects = [];
          for (const subjectId of subjectIds) {
            subjects.push(await this.getEntity(subjectId));
          }
          this.selectSubjects(subjects);
        } else {
          this.updateCounts();
        }
      }
    },
       async selectKit(kitId) {
      if (this.workflow?.smpl_workflow_uses_kits) {
        const kit = await this.getEntity(kitId);

        if (kit.smpl_subject_fk) {
          this.currentEntities.subjects = [await this.getEntity(kit.smpl_subject_fk)];
        }
        
        if (kit.smpl_case_fk) {
          this.currentEntities.cases = [await this.getEntity(kit.smpl_case_fk)];
        }

        const samples = await this.getSamplesByKit(kitId);
        this.selectSamples(samples);
        this.updateCounts();
      }
    },
    
    onEntitiesSelected(entities) {
  this.toBeSelected = entities;
},

   //==========================
    // GESTION DES VUES PERSONNALISÉES
    //==========================
    
customviewSelect() {
  // Traiter selon le type d'entité directement avec toBeSelected
  if (!this.customView) {
    return;
  }

  if (this.customView.entitytype_id == this.getEntityType("SMPL_SAMPLE").id) {
    const newSelectedIds = new Set(this.toBeSelected.map(e => e.id));
    const toDeselectIds = this.selectedCustomViewEntitiesIds.filter(id => !newSelectedIds.has(id));
    if (toDeselectIds.length > 0) this.unselectSampleIds(toDeselectIds);
    this.selectSamples(this.toBeSelected);
    this.closeCustomview();
  } else if (this.customView.entitytype_id == this.getEntityType("SMPL_SUBJECT").id) {
    this.selectSubjects(this.toBeSelected);
    this.closeCustomview();
  } else if (this.customView.entitytype_id == this.getEntityType("SMPL_CASE").id) {
    this.selectCases(this.toBeSelected);
    this.closeCustomview();
  } else if (this.customView.entitytype_id == this.getEntityType("SMPL_KIT").id) {
    // Attendre le chargement de tous les échantillons des kits sélectionnés avant
    // de fermer la vue (l'ancien forEach(async ...) fermait la vue avant la fin du chargement).
    this.currentEntities.kits = this.toBeSelected;
    Promise.all(this.toBeSelected.map(kit => this.getSamplesByKit(kit.id)))
      .then(results => {
        results.forEach(samples => this.selectSamples(samples));
        this.updateCounts();
        this.closeCustomview();
      });
  } else {
    this.closeCustomview();
  }
},
    
    closeCustomview() {
      this.customViewData.type = null;
      this.customView = null;
      this.reloadWorkflow();
    },
    
    closeForm() {
      this.currentForm = null;
      this.pipeline = [];
    },
    
    getFieldId(name) {
      const field = this.$store.state.fields.fields.find(field => field.name == name);
      return field.id;
    },
    
cleanTimestamps(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => this.cleanTimestamps(item));
  } else if (obj !== null && typeof obj === 'object') {
    const { created_at, updated_at, ...rest } = obj;
    const cleaned = {};
    for (const key in rest) {
      cleaned[key] = this.cleanTimestamps(rest[key]);
    }
    return cleaned;
  }
  return obj;
},
async showCustomViewAfterSampleCreation(smpl_collection_fk) {
  this.selectedCustomViewEntitiesIds = this.currentEntities.samples.map(entity => entity.id);

  const entity = await this.getEntity(smpl_collection_fk);
  const step = entity.smpl_workflow_step_fk ? this.getStep(entity.smpl_workflow_step_fk) : null;
  const line = step ? this.getLine(step.smpl_workflow_line_fk) : null;

  this.customViewData.title = (step ? line.smpl_label + "/" + step.type : "Collection") + " - New samples";

  let field;

  if (entity.entitytype_id == this.getEntityType("SMPL_COLLECTION").id) field = "smpl_collection_fk";
  else if (entity.entitytype_id == this.getEntityType("SMPL_DERIVATION").id) field = "smpl_derivation_fk";
  else field = "smpl_kit_fk";
  
  const operand = this.getFieldId(field);
   
 
  try {
    const currentCustomView = await this.dapp.$axios.$get(`/customviews/${this.customViewIds.samples}`);
    const cleanedView = this.cleanTimestamps(currentCustomView);
    const { entitytype_id, entitytype, ...cleanCustomView } = cleanedView;
    
    const existingFilters = cleanCustomView.filters || { type: "bracket", operationCode: "&&", conditions: [] };
    const conditions = existingFilters.conditions.filter(cond => {
      if (cond.type === "condition" && cond.operand === operand) return false;
      return true;
    });
    
    conditions.unshift({
      type: "condition",
      operationCode: "=",
      operand: operand,
      value: smpl_collection_fk
    });
    
    const filters = {
      ...existingFilters,
      conditions: conditions
    };
    
    const updateData = { ...cleanCustomView, filters: filters };
    
    await this.dapp.$axios.$put(`/customviews/${this.customViewIds.samples}`, updateData);
    this.customViewData.type = "SMPL_SAMPLE";
    this.customView = await this.dapp.$axios.$get(`/customviews/${this.customViewIds.samples}`);
  } catch (e) {
  } finally {
    this.loading = false;
  }
},

async showCustomViewForStep(stepId = null, smpl_sample_status_fk = null) {
  const scopeSamples = stepId
    ? this.currentEntities.samples.filter(s => s.smpl_workflow_step_fk === stepId)
    : this.currentEntities.samples;
  this.selectedCustomViewEntitiesIds = scopeSamples.map(entity => entity.id);

  let customViewId = this.customViewIds.samples;
  this.customViewData.title = "";
  
  if (stepId) {
    const step = this.getStep(stepId);
    if (!step) {
      return;
    }
    
    const line = this.getLine(step.smpl_workflow_line_fk);
    
    if (step.Custom_View_ID_Step) {
      customViewId = step.Custom_View_ID_Step;
    } else if (line?.smpl_custom_view_id) {
      customViewId = line.smpl_custom_view_id;
    }
    
    const breadcrumbs = this.generateBreadCrumbs(step);
    let title = breadcrumbs
      .map(crumb => crumb?.smpl_label ? crumb.smpl_label : crumb.type)
      .join("/");
    
    this.customViewData.title = title;
  }
  
  try {
    const currentCustomView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
    const cleanedView = this.cleanTimestamps(currentCustomView);
    const { entitytype_id, entitytype, ...cleanCustomView } = cleanedView;
    
    const existingFilters = cleanCustomView.filters || { type: "bracket", operationCode: "&&", conditions: [] };
    
    const statusFieldId = this.getFieldId("smpl_sample_status_fk");
    const stepFieldId = this.getFieldId("smpl_workflow_step_fk");
    const subjectFieldId = this.getFieldId("smpl_subject_fk");
    const caseFieldId = this.getFieldId("smpl_case_fk");
    
    const conditions = existingFilters.conditions.filter(cond => {
      if (cond.type === "condition") {
        if (cond.operand === statusFieldId) return false;
        if (cond.operand === stepFieldId) return false;
        if (cond.operand === subjectFieldId) return false;
        if (cond.operand === caseFieldId) return false;
      }
      return true;
    });
    
    if (smpl_sample_status_fk) {
      conditions.push({
        type: "condition",
        operationCode: "=",
        operand: statusFieldId,
        value: smpl_sample_status_fk
      });
    } else {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: statusFieldId,
        value: this.workflow.statuses.filter(status => status.smpl_status_is_active).map(entry => entry.id)
      });
    }
    
    if (stepId) {
      conditions.push({
        type: "condition",
        operationCode: "=",
        operand: stepFieldId,
        value: stepId
      });
    }
    
    if (this.currentEntities.subjects.length > 0) {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: subjectFieldId,
        value: this.currentEntities.subjects.map(entry => entry.id)
      });
    }
    
    if (this.currentEntities.cases.length > 0) {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: caseFieldId,
        value: this.currentEntities.cases.map(entry => entry.id)
      });
    }
    
    const filters = {
      ...existingFilters,
      conditions: conditions
    };
    
    const updateData = { ...cleanCustomView, filters: filters };
    
    await this.dapp.$axios.$put(`/customviews/${customViewId}`, updateData);
    this.customView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
    this.customViewData.type = "SMPL_SAMPLE";
  } catch (error) {
  }
},

async showCustomViewForSubjects() {
  let customViewId = this.customViewIds.subjects;
  this.customViewTitle = "Subjects";

  this.selectedCustomViewEntitiesIds = this.currentEntities.subjects.map(entry => entry.id);
  
  try {
    const currentCustomView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
    const cleanedView = this.cleanTimestamps(currentCustomView);
    const { entitytype_id, entitytype, ...cleanCustomView } = cleanedView;
    
    const existingFilters = cleanCustomView.filters || { type: "bracket", operationCode: "&&", conditions: [] };
    const studyFieldId = this.getFieldId("smpl_study_fk");
    
    const conditions = existingFilters.conditions.filter(cond => {
      if (cond.type === "condition" && cond.operand === studyFieldId) return false;
      return true;
    });
    
    conditions.unshift({
      type: "condition",
      operationCode: "=",
      operand: studyFieldId,
      value: this.workflow.smpl_study_fk
    });
    
    const filters = {
      ...existingFilters,
      conditions: conditions
    };
    
    const updateData = { ...cleanCustomView, filters: filters };
    
    await this.dapp.$axios.$put(`/customviews/${customViewId}`, updateData);
    this.customView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
  } catch (e) {
  } finally {
    this.loading = false;
  }
},

async showCustomViewForCases() {
  let customViewId = this.customViewIds.cases;
  this.customViewTitle = "Cases";

  this.selectedCustomViewEntitiesIds = this.currentEntities.cases.map(entry => entry.id);
  
  try {
    const currentCustomView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
    const cleanedView = this.cleanTimestamps(currentCustomView);
    const { entitytype_id, entitytype, ...cleanCustomView } = cleanedView;
    
    const existingFilters = cleanCustomView.filters || { type: "bracket", operationCode: "&&", conditions: [] };
    const studyFieldId = this.getFieldId("smpl_study_fk");
    const subjectFieldId = this.getFieldId("smpl_subject_fk");
    
    const conditions = existingFilters.conditions.filter(cond => {
      if (cond.type === "condition") {
        if (cond.operand === studyFieldId) return false;
        if (cond.operand === subjectFieldId) return false;
      }
      return true;
    });
    
    conditions.unshift({
      type: "condition",
      operationCode: "=",
      operand: studyFieldId,
      value: this.workflow.smpl_study_fk
    });
    
    if (this.currentEntities.subjects.length > 0) {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: subjectFieldId,
        value: this.currentEntities.subjects.map(subject => subject.id)
      });
    }
    
    const filters = {
      ...existingFilters,
      conditions: conditions
    };
    
    const updateData = { ...cleanCustomView, filters: filters };
    
    await this.dapp.$axios.$put(`/customviews/${customViewId}`, updateData);
    this.customView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
  } catch (e) {
  } finally {
    this.loading = false;
  }
},

async showCustomViewForKits() {
  let customViewId = this.customViewIds.kits;
  this.customViewTitle = "Kits";

  this.selectedCustomViewEntitiesIds = this.currentEntities.kits.map(entry => entry.id);
  
  try {
    const currentCustomView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
    const cleanedView = this.cleanTimestamps(currentCustomView);
    const { entitytype_id, entitytype, ...cleanCustomView } = cleanedView;
    
    const existingFilters = cleanCustomView.filters || { type: "bracket", operationCode: "&&", conditions: [] };
    const subjectFieldId = this.getFieldId("smpl_subject_fk");
    const caseFieldId = this.getFieldId("smpl_case_fk");
    
    const conditions = existingFilters.conditions.filter(cond => {
      if (cond.type === "condition") {
        if (cond.operand === subjectFieldId) return false;
        if (cond.operand === caseFieldId) return false;
      }
      return true;
    });
    
    if (this.currentEntities.subjects.length > 0) {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: subjectFieldId,
        value: this.currentEntities.subjects.map(subject => subject.id)
      });
    }
    
    if (this.currentEntities.cases.length > 0) {
      conditions.push({
        type: "condition",
        operationCode: "in",
        operand: caseFieldId,
        value: this.currentEntities.cases.map(casus => casus.id)
      });
    }
    
    const filters = {
      ...existingFilters,
      conditions: conditions
    };
    
    const updateData = { ...cleanCustomView, filters: filters };
    
    await this.dapp.$axios.$put(`/customviews/${customViewId}`, updateData);
    this.customView = await this.dapp.$axios.$get(`/customviews/${customViewId}`);
  } catch (e) {
  } finally {
    this.loading = false;
  }
},
    
    generateBreadCrumbs(entity, breadcrumbs = []) {
      breadcrumbs.unshift(entity);
      if (entity.smpl_workflow_line_fk) {
        this.generateBreadCrumbs(this.getLine(entity.smpl_workflow_line_fk), breadcrumbs);
      }
      return breadcrumbs;
    },

    //==========================
    // GESTION DES ÉVÉNEMENTS
    //==========================
    
    async scan(barcode) {
      let uri = await this.getRouteURLByName('smpl_get_entity_by_barcode');
      uri += '&barcode=' + barcode;
      const response = await this.dapp.$axios.$get(uri);
      
      if (response && response[0]) {
        const entity = response[0];
        
        if (entity.entitytype_id == this.getEntityType("SMPL_SAMPLE").id) {
          this.selectSamples([entity]);
          this.$toastNotifier.notifySuccess('Entity selected');
        }
        else if (entity.entitytype_id == this.getEntityType("SMPL_KIT").id) {
          await this.selectKit(entity.id);
          this.$toastNotifier.notifySuccess('Kit selected');
        }
        else if (entity.entitytype_id == this.getEntityType("SMPL_CASE").id) {
          const caseTranslation = this.$translate('field', 'label', this.getFieldByName('smpl_case_fk'));
          this.$toastNotifier.notifySuccess(caseTranslation + ' selected');
        }
        else if (entity.entitytype_id == this.getEntityType("SMPL_SUBJECT").id) {
          this.$toastNotifier.notifySuccess('Subject selected');
        }
        
        this.updateCounts();
      }
    },
    
    async centerOn(entity) {
      this.generateBreadCrumbs(entity).forEach((crumb, i) => {
        if (crumb?.visible == false) crumb.visible = true;
      });
      
      await this.updateCounts();
      
      this.getCanvasSvg().transition().call(this.zoom.transform, d3.zoomIdentity.translate(- entity.x * this.grid.step[0] * 2 + this.width / 3, (entity.y ? - entity.y * this.grid.step[1] * 2 + this.height / 3 : -entity.steps[0].y * this.grid.step[1] * 2 + this.height / 3)).scale(2));
    },

    //==========================
    // LOOKUP PAR BARCODE
    //==========================

    openLookupPopup() {
      this.closeLookupPopup()

      const overlay = document.createElement('div')
      overlay.id = 'smplLookupOverlay'
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(4,30,66,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;'

      const modal = document.createElement('div')
      modal.style.cssText = 'background:white;border-radius:12px;padding:28px;width:92%;max-width:1300px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 48px -12px rgba(4,30,66,0.18);font-family:"IBM Plex Sans",Arial,sans-serif;'

      modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="color:#0072CE;margin:0;font-size:1.3em;">Sample Lookup</h2>
          <button id="smplLookupClose" style="background:none;border:none;font-size:1.5em;cursor:pointer;color:#98A2B3;line-height:1;">✕</button>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
          <input id="smplLookupInput" type="text" placeholder="Enter barcode..."
            style="flex:1;padding:10px 16px;border:2px solid #0072CE;border-radius:20px;font-size:1em;outline:none;">
          <button id="smplLookupBtn" style="background:#0072CE;color:white;border:none;padding:10px 28px;border-radius:20px;cursor:pointer;font-weight:bold;font-size:1em;">
            Search
          </button>
        </div>
        <div id="smplLookupStatus"></div>
        <div id="smplLookupResults"></div>
      `

      overlay.appendChild(modal)
      document.body.appendChild(overlay)

      overlay.addEventListener('click', e => { if (e.target === overlay) this.closeLookupPopup() })
      document.getElementById('smplLookupClose').addEventListener('click', () => this.closeLookupPopup())
      document.getElementById('smplLookupInput').addEventListener('keyup', e => { if (e.key === 'Enter') this.lookupSearch() })
      document.getElementById('smplLookupBtn').addEventListener('click', () => this.lookupSearch())

      setTimeout(() => document.getElementById('smplLookupInput')?.focus(), 100)
    },

    closeLookupPopup() {
      const el = document.getElementById('smplLookupOverlay')
      if (el) el.remove()
    },

    async lookupSearch() {
      const barcode = document.getElementById('smplLookupInput')?.value?.trim()
      if (!barcode) return

      const statusEl = document.getElementById('smplLookupStatus')
      const resultsEl = document.getElementById('smplLookupResults')
      const btn = document.getElementById('smplLookupBtn')

      statusEl.innerHTML = '<div style="color:#667085;padding:8px 0;">Searching...</div>'
      resultsEl.innerHTML = ''
      if (btn) { btn.disabled = true; btn.textContent = '...' }

      try {
        // 1. Trouver le sample par barcode
        let uri = await this.getRouteURLByName('smpl_get_entity_by_barcode')
        uri += '&barcode=' + encodeURIComponent(barcode)
        const response = await this.dapp.$axios.$get(uri)

        const foundSample = Array.isArray(response)
          ? (response.find(e => String(e.BARCODE) === barcode) ?? response[0])
          : response

        if (!foundSample) {
          statusEl.innerHTML = `<div style="background:#FEF3F2;border:1px solid #FDA29B;padding:10px 14px;border-radius:8px;color:#D92D20;">No sample found with barcode "${barcode}"</div>`
          return
        }

        if (foundSample.entitytype_id !== this.getEntityType('SMPL_SAMPLE')?.id) {
          statusEl.innerHTML = `<div style="background:#FFFAEB;border:1px solid #FEC84B;padding:10px 14px;border-radius:8px;color:#B54708;">The scanned entity is not a sample.</div>`
          return
        }

        statusEl.innerHTML = '<div style="color:#667085;padding:8px 0;">Loading associated samples...</div>'

        // 2. Trouver tous les samples de la même collection
        let samples = [foundSample]
        if (foundSample.smpl_collection_fk) {
          try {
            const sampleTypeId = this.getEntityType('SMPL_SAMPLE')?.id
            const result = await this.dapp.$axios.$get('/entities', {
              params: { entitytype_id: sampleTypeId, smpl_collection_fk: foundSample.smpl_collection_fk }
            })
            const arr = Array.isArray(result) ? result : (result?.data ?? null)
            if (arr && arr.length > 0) samples = arr
          } catch (e) { /* fallback: show only the found sample */ }
        }

        statusEl.innerHTML = `<div style="background:#EAF5FF;border:1px solid #93C8F4;padding:10px 14px;border-radius:8px;color:#0072CE;margin-bottom:12px;">
          Loading events for <strong>${samples.length}</strong> sample(s)...
        </div>`

        // 3. Construire le tableau avec les événements
        await this.buildLookupTable(samples, foundSample, resultsEl)

        statusEl.innerHTML = `<div style="background:#EAF5FF;border:1px solid #93C8F4;padding:10px 14px;border-radius:8px;color:#0072CE;margin-bottom:12px;">
          <strong>${samples.length}</strong> sample(s) associated with barcode <strong>${barcode}</strong>
        </div>`

      } catch (e) {
        statusEl.innerHTML = `<div style="background:#FEF3F2;border:1px solid #FDA29B;padding:10px 14px;border-radius:8px;color:#D92D20;">Error: ${e.message}</div>`
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Search' }
      }
    },

    async buildLookupTable(samples, foundSample, container) {
      const eventTypeMap = {}
      const orderRef = ['Creation', 'Collection', 'Reception', 'Aliquoting', 'Analysis', 'Storage', 'Destruction']
      const eventIcons = {
        'Creation': '✦', 'Collection': '🩸', 'Reception': '📥',
        'Aliquoting': '🧪', 'Analysis': '🔬', 'Storage': '❄️', 'Destruction': '🗑️'
      }

      // Champs système — jamais affichés
      const SYSTEM_KEYS = new Set([
        'id', 'entitytype_id', 'entitytype', 'created_at', 'updated_at',
        'PROJECTS', 'CREATED_BY', 'UPDATED_BY'
      ])

      // Champs déjà affichés dans le header sample — ne pas répéter dans les champs extra
      const SAMPLE_HEADER_KEYS = new Set([
        'BARCODE', 'smpl_id', 'smpl_workflow_line_fk', 'smpl_content_volume',
        'smpl_volume_unit', 'smpl_sample_status_fk', '_lineName', '_statusLabel', '_events'
      ])

      // Champs déjà affichés dans la ligne titre de l'événement
      const EVENT_HEADER_KEYS = new Set([
        'smpl_event_type_fk', 'smpl_event_date', 'smpl_event_start_time', 'created_at'
      ])

      const fmtDate = d => {
        if (!d) return null
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return null
        return dt.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      const fmtTime = d => {
        if (!d) return null
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return null
        return dt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
      }

      // Formate une valeur selon le type de champ
      const fmtValue = (key, val) => {
        if (val === null || val === undefined || val === '') return null
        if (typeof val === 'boolean') return val ? 'Oui' : 'Non'
        if (Array.isArray(val)) return val.length > 0 ? `${val.length} éléments` : null
        if (typeof val === 'string') {
          if (/_date$/.test(key)) return fmtDate(val) || val
          if (/_at$/.test(key)) return fmtDate(val) || val
          return val
        }
        return String(val)
      }

      // Label lisible à partir du nom de champ
      const fieldLabel = name => name
        .replace(/^smpl_/, '').replace(/^chuv_/, '')
        .replace(/_fk$/, '').replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())

      // Retourne tous les champs affichables d'un objet, hors clés à exclure
      const getFields = (obj, skipKeys) => {
        const result = []
        for (const [key, val] of Object.entries(obj)) {
          if (SYSTEM_KEYS.has(key)) continue
          if (skipKeys.has(key)) continue
          if (key.startsWith('_')) continue
          if (val === null || val === undefined || val === '') continue
          if (Array.isArray(val) && val.length === 0) continue

          let display
          if (Array.isArray(val)) {
            display = `${val.length} éléments`
          } else {
            // Essayer la résolution choice (FK de liste de choix)
            const choiceVal = this.getChoiceValue(val)
            if (choiceVal !== undefined && choiceVal !== null) {
              // C'est un choix de liste → afficher le label résolu
              display = choiceVal
            } else {
              display = fmtValue(key, val)
            }
          }

          if (display !== null && display !== undefined) {
            result.push({ label: fieldLabel(key), value: display })
          }
        }
        return result
      }

      // Chargement des événements
      for (const sample of samples) {
        sample._events = []
        const eventIds = Array.isArray(sample.smpl_events_fk) ? sample.smpl_events_fk : []
        for (const evId of eventIds) {
          try {
            const ev = await this.dapp.$axios.$get('/entities/' + evId)
            if (ev && ev.smpl_event_type_fk) {
              sample._events.push(ev)
              if (!eventTypeMap[ev.smpl_event_type_fk]) {
                const et = this.getEventTypeById(ev.smpl_event_type_fk)
                eventTypeMap[ev.smpl_event_type_fk] = et?.smpl_label ?? ('Event ' + ev.smpl_event_type_fk)
              }
            }
          } catch (e) {}
        }
        sample._lineName = this.getLine(sample.smpl_workflow_line_fk)?.smpl_label ?? null
        sample._statusLabel = this.workflow.statuses?.find(s => s.id == sample.smpl_sample_status_fk)?.smpl_label ?? null
      }

      const etIds = Object.keys(eventTypeMap).sort((a, b) => {
        const ai = orderRef.indexOf(eventTypeMap[a])
        const bi = orderRef.indexOf(eventTypeMap[b])
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      })

      let html = `<div style="display:flex;flex-direction:column;gap:14px;">`

      samples.forEach(sample => {
        const isTarget = sample.id === foundSample.id
        const isActive = this.statusIsActive(sample.smpl_sample_status_fk)
        const volUnit = sample.smpl_volume_unit ? (this.getChoiceValue(sample.smpl_volume_unit) ?? '') : ''
        const volume = sample.smpl_content_volume != null ? `${sample.smpl_content_volume} ${volUnit}`.trim() : '—'
        const borderColor = isTarget ? '#0072CE' : '#E4E7EC'
        const bgCard = isTarget ? '#f0faf9' : '#fff'

        html += `<div style="border:2px solid ${borderColor};border-radius:10px;background:${bgCard};overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.07);">`

        // ── Header principal sample ──
        html += `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:${isTarget ? '#EAF5FF' : '#F9FAFB'};border-bottom:1px solid ${borderColor};flex-wrap:wrap;">`
        html += `<div style="display:flex;align-items:center;gap:6px;">
          <span style="font-weight:700;font-size:1em;color:${isTarget ? '#0072CE' : '#041E42'};">${sample.BARCODE || '—'}</span>
          ${isTarget ? `<span style="background:#0072CE;color:white;font-size:0.7em;padding:1px 7px;border-radius:10px;font-weight:600;">scan</span>` : ''}
        </div>`
        if (sample.smpl_id) html += `<span style="font-family:monospace;font-size:0.8em;color:#667085;background:#F2F4F7;padding:2px 8px;border-radius:6px;">${sample.smpl_id}</span>`
        if (sample._lineName) html += `<span style="font-size:0.82em;color:#667085;">📋 ${sample._lineName}</span>`
        html += `<span style="font-size:0.82em;color:#667085;">💧 ${volume}</span>`
        if (sample._statusLabel) html += `<span style="padding:2px 10px;border-radius:10px;background:${isActive ? '#E6FBF3' : '#F2F4F7'};color:${isActive ? '#00895A' : '#98A2B3'};font-size:0.78em;font-weight:600;">${sample._statusLabel}</span>`
        html += `</div>`

        // ── Tous les autres champs du sample ──
        const sampleFields = getFields(sample, SAMPLE_HEADER_KEYS)
        if (sampleFields.length > 0) {
          html += `<div style="display:flex;flex-wrap:wrap;gap:5px 18px;padding:7px 16px;border-bottom:1px solid #E4E7EC;background:${isTarget ? '#f5fcfb' : '#fafafa'};">`
          sampleFields.forEach(f => {
            html += `<span style="font-size:0.76em;color:#667085;"><span style="color:#667085;font-weight:600;">${f.label}:</span> ${f.value}</span>`
          })
          html += `</div>`
        }

        // ── Événements ──
        html += `<div style="padding:6px 16px 12px;">`
        if (etIds.length === 0) {
          html += `<div style="color:#98A2B3;font-size:0.82em;font-style:italic;padding:6px 0;">No events</div>`
        } else {
          html += `<div style="display:flex;flex-direction:column;">`
          etIds.forEach((etId, i) => {
            const ev = sample._events?.find(e => e.smpl_event_type_fk == etId)
            const label = eventTypeMap[etId]
            const icon = eventIcons[label] ?? '•'
            const isLast = i === etIds.length - 1

            html += `<div style="display:flex;align-items:flex-start;gap:10px;padding:7px 0;${isLast ? '' : 'border-bottom:1px solid #F2F4F7;'}">`

            // Timeline dot + connecteur
            html += `<div style="display:flex;flex-direction:column;align-items:center;min-width:14px;margin-top:3px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${ev ? '#0072CE' : '#D0D5DD'};flex-shrink:0;"></div>
              ${!isLast ? `<div style="width:2px;flex:1;min-height:16px;background:#E4E7EC;margin-top:3px;"></div>` : ''}
            </div>`

            html += `<div style="flex:1;min-width:0;">`

            // Ligne titre : type + date + heure
            html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`
            html += `<span style="font-size:0.87em;font-weight:700;color:${ev ? '#041E42' : '#D0D5DD'};">${icon} ${label}</span>`
            if (ev) {
              const evDate = fmtDate(ev.smpl_event_date) || fmtDate(ev.created_at)
              if (evDate) html += `<span style="font-size:0.8em;color:#667085;background:#F2F4F7;padding:1px 7px;border-radius:6px;">📅 ${evDate}</span>`
              if (ev.smpl_event_start_time) {
                html += `<span style="font-size:0.78em;color:#667085;">⏱ ${ev.smpl_event_start_time}</span>`
              } else if (!ev.smpl_event_date) {
                const t = fmtTime(ev.created_at)
                if (t) html += `<span style="font-size:0.78em;color:#98A2B3;">⏱ ${t}</span>`
              }
            } else {
              html += `<span style="font-size:0.78em;color:#D0D5DD;font-style:italic;">pas encore effectué</span>`
            }
            html += `</div>`

            // Tous les autres champs de l'événement
            if (ev) {
              const evFields = getFields(ev, EVENT_HEADER_KEYS)
              if (evFields.length > 0) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px;">`
                evFields.forEach(f => {
                  html += `<span style="font-size:0.76em;color:#667085;"><span style="color:#98A2B3;font-weight:600;">${f.label}:</span> ${f.value}</span>`
                })
                html += `</div>`
              }
            }

            html += `</div>` // end event content
            html += `</div>` // end row
          })
          html += `</div>`
        }

        html += `</div>` // end events section
        html += `</div>` // end card
      })

      html += `</div>`
      container.innerHTML = html
    },

    getPrevSteps(step) {
      let prevSteps = [];
      if (step.smpl_workflow_step_is_repeatable) prevSteps.push(step.id);
      const line = this.workflow.lines.find(line => line.id == step.smpl_workflow_line_fk);
      let flag = true;
      let order = step.smpl_order - 1;
      
      while (flag) {
        const ps = line.steps.find(s => s.smpl_order == order);
        if (!ps) break;
        
        prevSteps.push(ps.id);
        if (ps?.smpl_workflow_step_batch_fk) prevSteps.push(ps.smpl_workflow_step_batch_fk);
        
        if (!ps.smpl_workflow_step_is_optional && ps.type != "GoTo") break;
        order--;
      }
      
      return prevSteps;
    },

    //==========================
    // QUANTITÉ PAR TYPE DE CAS (Line_Case_Type_Quantity)
    //==========================

    // Ouvre/ferme le menu custom du filtre "Case type" (voir enterToolbar()).
    // Ferme aussi tout seul au clic en dehors (.dd-casetype-wrapper) — écouteur
    // posé UNE seule fois sur document (lazy, réutilisé à chaque ouverture) et
    // retiré dès la fermeture pour ne jamais s'accumuler au fil des toggles.
    toggleCaseTypeDropdown(e) {
      if (e) e.stopPropagation();
      if (!this._closeCaseTypeDropdownOnOutsideClick) {
        this._closeCaseTypeDropdownOnOutsideClick = (evt) => {
          // Le déclencheur (.dd-casetype-wrapper, dans le toolbar) ET le popup
          // (#dd-casetype-portal, injecté à part dans <body> — voir enterToolbar())
          // comptent tous les deux comme "à l'intérieur".
          if (!evt.target.closest('.dd-casetype-wrapper, #dd-casetype-portal')) {
            this.caseTypeDropdownOpen = false;
            document.removeEventListener('click', this._closeCaseTypeDropdownOnOutsideClick);
            this.enterToolbar();
          }
        };
      }
      this.caseTypeDropdownOpen = !this.caseTypeDropdownOpen;
      if (this.caseTypeDropdownOpen) {
        // setTimeout : évite que CE MÊME clic (déjà en train de bubbler vers
        // document) ne déclenche immédiatement la fermeture qu'on vient d'armer.
        setTimeout(() => document.addEventListener('click', this._closeCaseTypeDropdownOnOutsideClick), 0);
      } else {
        document.removeEventListener('click', this._closeCaseTypeDropdownOnOutsideClick);
      }
      this.enterToolbar();
    },

    // Lance les deux gros GET /entities (Line_Case_Type_Quantity + SMPL_CASE_TYPE,
    // ~1000ms chacun sur ~1850 lignes de tout le système, aucun des deux filtrable
    // côté serveur) SANS ATTENDRE — ni l'un l'autre, ni les données du workflow, dont
    // ils n'ont besoin qu'après coup (au moment de regrouper/scoper le résultat).
    // Permet à loadWorkflow() de démarrer ce prefetch AVANT même d'attendre le fetch
    // du workflow lui-même (~1.9s), pour que ces ~1000ms se chevauchent avec cette
    // attente au lieu de s'additionner après coup.
    prefetchCaseTypeEntities() {
      const lineCaseTypeEntityType = this.getEntityType("Line_Case_Type_Quantity");
      const caseTypeEntityType = this.getEntityType("SMPL_CASE_TYPE");
      return {
        lineCaseTypeEntityType,
        caseTypeEntityType,
        entriesPromise: lineCaseTypeEntityType
          ? this.dapp.$axios.$get('/entities', { params: { entitytype_id: lineCaseTypeEntityType.id } })
          : Promise.resolve(null),
        caseTypesPromise: caseTypeEntityType
          ? this.dapp.$axios.$get('/entities', { params: { entitytype_id: caseTypeEntityType.id } })
          : Promise.resolve(null),
      };
    },

    async loadLineCaseTypeQuantities(prefetch = null) {
      const tStart = performance.now();
      const p = prefetch || this.prefetchCaseTypeEntities();
      const entityType = p.lineCaseTypeEntityType;
      // Entity type absent sur ce déploiement : comportement par défaut inchangé partout.
      if (!entityType) {
        this.workflow.lines.forEach(line => { line.caseTypeQuantities = []; });
        this.caseTypeFilterOptions = [];
        this.applyCaseTypeFilter();
        return;
      }

      // loadCaseTypeOptions() réutilise le même prefetch (sa requête est déjà en vol,
      // voire déjà revenue) — pas de nouvelle requête lancée ici.
      const tCaseTypeOptions = performance.now();
      const caseTypeOptionsPromise = this.loadCaseTypeOptions(p);

      let entries = [];
      try {
        const tFetch = performance.now();
        const result = await p.entriesPromise;
        const rawEntries = Array.isArray(result) ? result : (result?.data ?? []);
        // GET /entities avec seulement entitytype_id en paramètre ne filtre PAS réellement
        // côté serveur (il renvoie toutes les entités du système) — revérifier nous-mêmes,
        // sinon une entité d'un autre type partageant par coïncidence un smpl_workflow_line_fk
        // de même valeur se fait passer pour une entrée Line_Case_Type_Quantity valide.
        entries = rawEntries.filter(entry => entry.entitytype_id == entityType.id);
        console.log(`[perf] loadLineCaseTypeQuantities: GET /entities took ${(performance.now() - tFetch).toFixed(0)}ms (${rawEntries.length} rows fetched from the WHOLE system, ${entries.length} actually relevant)`);
      } catch (e) {
        entries = [];
      }

      // Regrouper les entrées par ligne pour ce workflow uniquement.
      this.workflow.lines.forEach(line => {
        line.caseTypeQuantities = entries.filter(entry => entry.smpl_workflow_line_fk == line.id);
      });

      // La liste des types de cas du dropdown vient des VRAIES entités SMPL_CASE_TYPE de ce
      // workflow — pas des entrées Line_Case_Type_Quantity (qui n'en référencent qu'un sous-
      // ensemble, celui pour lequel un override existe déjà). Son fetch tourne déjà en
      // parallèle depuis le début de cette méthode — on attend juste qu'il finisse ici.
      await caseTypeOptionsPromise;
      console.log(`[perf] loadLineCaseTypeQuantities: loadCaseTypeOptions() (lancé en parallèle) took ${(performance.now() - tCaseTypeOptions).toFixed(0)}ms total since start`);
      console.log(`[perf] loadLineCaseTypeQuantities: TOTAL ${(performance.now() - tStart).toFixed(0)}ms`);
    },

    // Construit caseTypeFilterOptions à partir des entités SMPL_CASE_TYPE réellement définies
    // pour ce workflow (champ smpl_workflow_fk), avec leur vrai label (smpl_case_type_label).
    async loadCaseTypeOptions(prefetch = null) {
      const p = prefetch || this.prefetchCaseTypeEntities();
      const caseTypeEntityType = p.caseTypeEntityType;
      if (!caseTypeEntityType) {
        this.caseTypeFilterOptions = [];
        this.applyCaseTypeFilter();
        return;
      }

      let entities = [];
      try {
        const tFetch = performance.now();
        const result = await p.caseTypesPromise;
        const rawEntities = Array.isArray(result) ? result : (result?.data ?? []);
        // Même bug que pour Line_Case_Type_Quantity : entitytype_id seul ne filtre pas
        // côté serveur, on revérifie nous-mêmes.
        entities = rawEntities.filter(entity => entity.entitytype_id == caseTypeEntityType.id);
        console.log(`[perf] loadCaseTypeOptions: GET /entities took ${(performance.now() - tFetch).toFixed(0)}ms (${rawEntities.length} rows fetched from the WHOLE system, ${entities.length} actually relevant)`);
      } catch (e) {
        entities = [];
      }

      // Pas de scoping par workflow pour l'instant : tous les Case Type existants
      // sont proposés dans le dropdown, quel que soit le workflow.
      this.caseTypeFilterOptions = entities
        .map(entity => ({ id: entity.id, label: entity.smpl_case_type_label || entity.smpl_label || `#${entity.id}` }))
        .sort((a, b) => a.label.localeCompare(b.label));

      this.applyCaseTypeFilter();
    },

    // Résout LA LISTE des types de cas effectivement actifs pour filtrer/résoudre
    // les quantités — utilisée par resolveLineQuantity()/applyCaseTypeFilter() ET
    // pour marquer les options sélectionnées du <select multiple> "Case type" :
    // - 'ALL' (option "All case types" choisie explicitement dans le dropdown, ou
    //   plus aucune option cochée) -> pas de filtre, tableau vide.
    // - un tableau (une ou plusieurs options cochées explicitement dans le
    //   dropdown multi-sélection) -> exactement ces types-là.
    // - selectedCaseTypeFilter jamais touché (null, valeur initiale) -> suit
    //   automatiquement les types de TOUS les cases actuellement sélectionnés
    //   (pas seulement le premier) — plusieurs cases de types différents
    //   restent donc tous visibles simultanément (lignes ET comptes, updateCounts
    //   ne comptant que sur les steps encore visibles après ce filtre) tant
    //   qu'aucun choix explicite n'a été fait dans le dropdown.
    getEffectiveCaseTypeFilters() {
      if (this.selectedCaseTypeFilter === 'ALL') return [];
      if (Array.isArray(this.selectedCaseTypeFilter)) return this.selectedCaseTypeFilter;
      const types = this.currentEntities.cases
        .map(c => c?.smpl_case_type_fk)
        .filter(t => t != null);
      return [...new Set(types)];
    },

    // Filtre une liste de samples selon le filtre "type de cas" du dropdown
    // toolbar (getEffectiveCaseTypeFilters) — via le type de cas de LEUR PROPRE
    // case (smpl_case_fk), pas seulement via la ligne à laquelle ils
    // appartiennent. Sans ça, une ligne SANS restriction Line_Case_Type_Quantity
    // (applicable à tous les types) reste entièrement visible et affiche TOUS
    // ses samples dès que le dropdown filtre sur un type précis, tant qu'aucun
    // case/subject n'est sélectionné pour scoper autrement. Utilisée par
    // updateCounts() (comptes affichés) ET par les boutons "all/none" (étape et
    // statut) pour que la sélection corresponde exactement au compte affiché.
    // Pas de filtre effectif -> retour immédiat, pas de fetch déclenché.
    //
    // Résolution via le mapping/mécanisme déjà existant ailleurs dans ce
    // fichier (getEntity(id), utilisé tel quel par ex. dans selectCases()) —
    // la case contient déjà smpl_case_type_fk, pas besoin d'un endpoint dédié
    // ni d'un fetch en masse : on ne charge QUE les cases référencées par ces
    // samples (currentEntities.cases si déjà en mémoire, sinon getEntity),
    // mises en cache dans caseTypeByCaseId pour ne jamais refetcher deux fois
    // la même case au fil des toggles du dropdown/changements de sélection.
    async filterSamplesByCaseType(samples) {
      const effectiveCaseTypeFilters = this.getEffectiveCaseTypeFilters();
      if (effectiveCaseTypeFilters.length === 0) {
        return samples;
      }

      const caseIds = [...new Set(samples.map(s => s.smpl_case_fk).filter(id => id != null))];
      const missingIds = caseIds.filter(id => !this.caseTypeByCaseId.has(id));

      if (missingIds.length > 0) {
        await Promise.all(missingIds.map(async id => {
          const known = this.currentEntities.cases.find(c => c.id == id);
          const casus = known || await this.getEntity(id);
          this.caseTypeByCaseId.set(id, casus?.smpl_case_type_fk ?? null);
        }));
      }

      return samples.filter(sample => {
        if (sample.smpl_case_fk == null) return false; // pas de case -> pas de type de cas résoluble
        const caseType = this.caseTypeByCaseId.get(sample.smpl_case_fk);
        return caseType != null && effectiveCaseTypeFilters.some(f => f == caseType);
      });
    },

    // Résout la quantité à utiliser pour une ligne selon le(s) type(s) de cas effectif(s)
    // (getEffectiveCaseTypeFilters — le filtre dropdown s'il est choisi, sinon le(s)
    // type(s) du/des cas réellement sélectionné(s)/en cours de création).
    // - Aucune entrée Line_Case_Type_Quantity pour cette ligne -> comportement normal/pré-existant :
    //   la ligne s'applique TOUJOURS, avec sa propre quantité (même si celle-ci est vide/null —
    //   dans ce cas l'utilisateur remplit la quantité/les codes-barres manuellement, comme avant
    //   l'introduction de cette fonctionnalité). Ne JAMAIS retourner littéralement `null` ici :
    //   `null` est réservé exclusivement au signal "cette ligne ne s'applique pas à ce type de cas"
    //   (branche ci-dessous), pour que l'appelant (`if (quantity === null) return;`) ne l'exclue pas.
    // - Des entrées existent -> seul un type de cas listé s'applique, à sa propre quantité.
    //   Type de cas non listé (ou pas de cas/filtre actif) -> la ligne ne s'applique pas (retourne null).
    resolveLineQuantity(line) {
      const entries = line.caseTypeQuantities;
      const effectiveCaseTypeFilters = this.getEffectiveCaseTypeFilters();

      if (!entries || entries.length === 0) {
        // Un filtre "type de cas" effectif est actif (dropdown explicite OU suivi
        // automatique du/des case(s) sélectionné(s)) : une ligne sans aucune config
        // Line_Case_Type_Quantity ne concerne QUE "Tous les types de cas" — dès
        // qu'un type précis s'applique, elle ne s'applique plus et doit disparaître.
        if (effectiveCaseTypeFilters.length > 0) return null;

        // Pas de filtre effectif ("Tous les types de cas", ou contexte réel sans
        // dropdown) -> comportement normal/pré-existant : la ligne s'applique
        // toujours, avec sa propre quantité.
        const fallback = line.smpl_workflow_line_quantity;
        return fallback === null ? undefined : fallback;
      }

      // Plusieurs cases sélectionnés peuvent avoir des types différents qui
      // matchent TOUS les deux cette ligne — additionner leurs quantités
      // (ex: type A demande 2 tubes, type B en demande 3 -> 5 au total pour
      // cette ligne tant que les deux cases restent sélectionnés simultanément).
      // Avec un seul case sélectionné (cas le plus courant), matches contient
      // au plus 1 entrée -> comportement strictement identique à avant.
      //
      // IMPORTANT : comparaison en égalité SOUPLE (some + ==), pas .includes()
      // (égalité stricte). Le <select multiple> du dropdown ne renvoie QUE des
      // strings (`Array.from(e.target.selectedOptions).map(o => o.value)`), donc
      // selectedCaseTypeFilter contient par ex. ["1892"] (strings) alors que
      // entry.smpl_case_type_fk est un nombre — .includes() les aurait comparés
      // en stricte et n'aurait jamais matché, cachant TOUTES les lignes dès
      // qu'un type précis était choisi dans le dropdown (même sans aucun
      // subject/case sélectionné).
      const matches = entries.filter(entry => effectiveCaseTypeFilters.some(f => f == entry.smpl_case_type_fk));
      if (matches.length === 0) return null;
      return matches.reduce((sum, m) => sum + (m.smpl_line_quantity || 0), 0);
    },

    // Recalcule, pour chaque ligne du workflow, si elle correspond au filtre "type de
    // cas" effectivement actif (dropdown explicite ou suivi automatique du case
    // sélectionné). Mis en cache sur line._matchesCaseTypeFilter pour éviter de
    // rappeler resolveLineQuantity() (et refaire tout le calcul d'entrées) à chaque
    // frame de rendu — appelé une fois ici plutôt que dans chacun des filtres d'affichage.
    applyCaseTypeFilter() {
      if (!this.workflow?.lines) return;
      const effectiveCaseTypeFilters = this.getEffectiveCaseTypeFilters();
      this.workflow.lines.forEach(line => {
        line._matchesCaseTypeFilter = effectiveCaseTypeFilters.length === 0
          ? true
          : this.resolveLineQuantity(line) !== null;
      });
    },

    //==========================
    // GESTION DES COLLECTIONS
    //==========================
    
    getPrecollectionSamples() {
      return this.currentEntities.samples
        .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
        .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
        .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true)
        .filter(sample => sample.smpl_sample_status_fk == this.getStatusId("Dispatched"));
    },
    
    async startCollection() {
      this.collectionOngoing = true;
      
      if (this.currentEntities.subjects.length == 0) {
        await this.promptNewSubject();
      }
      else if (this.usesCases && this.currentEntities.cases.length == 0) {
        await this.promptNewCase();
      }
      else {
        const selectedContainers = this.currentEntities.samples
          .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
          .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
          .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true)
          .filter(sample => sample.smpl_sample_status_fk == this.getStatusId("Dispatched"));
          
        if (selectedContainers.length) {
          this.promptNewCollection(selectedContainers);
        }
        else {
          await this.promptNewKit();
        }
      }
      
      this.popPipeline();
    },
    
    async startKitCreation() {
      await this.promptNewKit(false, true);
      this.popPipeline();
    },
    
    async promptNewSubject() {
      this.closeCustomview();

      let entity = {
        entitytype_id: this.getEntityType("SMPL_SUBJECT").id,
        smpl_study_fk: this.workflow.smpl_study_fk,
        // Tableau, pas scalaire : smpl_workflow_fk est un champ PARTAGÉ entre
        // plusieurs entity types (SMPL_CASE_TYPE, SMPL_WORKFLOW_LINE,
        // SMPL_SUBJECT, SMPL_CASE...) — l'avoir mis en "multiple" pour un usage
        // (tâche 8, case type) l'a rendu multiple PARTOUT où il est attaché.
        smpl_workflow_fk: [this.workflow.id]
      };

      let template;
      if (this.workflow.smpl_subject_id_gen_fk) {
        template = await this.getEntity(this.workflow.smpl_subject_id_gen_fk);
        const idAssembly = await this.dapp.$axios.$post(await this.getRouteURLByName('smpl_generate_id'), { entity: entity, template: template });
      
        entity.smpl_id_stem = idAssembly.stem ? idAssembly.stem : "undefined";
        entity.smpl_id_nb = idAssembly.nb;
        entity.smpl_id = idAssembly.id;
      }

      const forms = [{
        id: this.workflow.smpl_workflow_subject_form_id, form: null, isValidForm: true,
        title: this.collectionOngoing ? "Collection - New subject" : "New subject",
        defaultEntity: entity,
        template: template
      }];
      
      this.pipeline.push(forms);
      this.popPipeline();
    },
    
    async promptNewCase() {
      this.closeCustomview();

      let entity = {
        entitytype_id: this.getEntityType("SMPL_CASE").id,
        smpl_subject_fk: this.currentEntities.subjects[0]?.id,
        smpl_study_fk: this.workflow.smpl_study_fk,
        // Tableau — voir commentaire dans promptNewSubject (champ smpl_workflow_fk partagé, multiple partout).
        smpl_workflow_fk: [this.workflow.id]
      };

      let template;
      if (this.workflow.smpl_case_id_gen_fk) {
        template = await this.getEntity(this.workflow.smpl_case_id_gen_fk);
        const idAssembly = await this.dapp.$axios.$post(await this.getRouteURLByName('smpl_generate_id'), { entity: entity, template: template });
        
        entity.smpl_id_stem = idAssembly.stem ? idAssembly.stem : "undefined";
        entity.smpl_id_nb = idAssembly.nb;
        entity.smpl_id = idAssembly.id;
      }

      const forms = [{
        id: this.workflow.smpl_workflow_case_form_id, form: null, isValidForm: true,
        title: (this.collectionOngoing ? "Collection - " : "") + "New case for subject " + this.currentEntities.subjects[0]?.smpl_id,
        defaultEntity: entity,
        template: template
      }];
      
      this.pipeline.push(forms);
      this.popPipeline();
    },
    
    async promptNewKit(collection = true, isReal = false) {
      let entity = {
        entitytype_id: this.getEntityType("SMPL_KIT").id,
        smpl_kit_is_real: isReal,
        smpl_subject_fk: this.currentEntities.subjects[0]?.id,
        smpl_case_fk: this.currentEntities.cases[0]?.id,
      };

      let template;
      if (this.workflow.smpl_kit_id_gen_fk) {
        template = await this.getEntity(this.workflow.smpl_kit_id_gen_fk);
        const idAssembly = await this.dapp.$axios.$post(await this.getRouteURLByName('smpl_generate_id'), { entity: entity, template: template });
        
        entity.smpl_id_stem = idAssembly.stem ? idAssembly.stem : "undefined";
        entity.smpl_id_nb = idAssembly.nb;
        entity.smpl_id = idAssembly.id;
      }

      const forms = [{
        id: this.workflow.smpl_workflow_kit_form_id, form: null, isValidForm: true,
        title: collection ? "Collection information" : "Kit content",
        defaultEntity: entity,
        template: template
      }];

      if (collection) {
        forms.push({
          id: this.getEventTypeByName("Collection").smpl_template_form_id, form: null, isValidForm: true,
          defaultEntity: {
            entitytype_id: this.getEntityType("SMPL_EVENT").id,
            smpl_event_type_fk: this.getEventTypeByName("Collection").id,
            smpl_subject_fk: this.currentEntities.subjects[0]?.id,
            smpl_case_fk: this.currentEntities.cases[0]?.id,
            SMPL_CREATION_with_collection: true
          }
        });
      }

      this.workflow.lines.filter(line => line.smpl_workflow_line_is_kit).forEach((line, i) => {
        const quantity = this.resolveLineQuantity(line);
        if (quantity === null) return; // ce type de cas ne concerne pas cette ligne
        forms.push({
          id: this.sampleCreationFormId,
          form: null, isValidForm: true,
          title: line.smpl_label,
          defaultEntity: {
            entitytype_id: this.getEntityType("SMPL_CREATION").id,
            smpl_workflow_line_fk: line.id,
            SMPL_CREATION_with_container: true,
            SMPL_CREATION_with_collection: collection,
            smpl_workflow_line_quantity: quantity
          }
        });
      });

      this.pipeline.push(forms);
    },

    promptNewCollection(samples) {
      const sampleIds = samples.map(sample => sample.id);
      
      const forms = [{
        id: this.getEventTypeByName("Collection").smpl_template_form_id, form: null, isValidForm: true,
        title: "Collection of " + samples.length + " sample" + (samples.length > 1 ? "s" : ""),
        defaultEntity: {
          entitytype_id: this.getEntityType("SMPL_EVENT").id,
          smpl_event_type_fk: this.getEventTypeByName("Collection").id,
          smpl_samples_fk: sampleIds
        }
      }];
      
      this.pipeline.push(forms);
    },
    
    standardBatchCollection() {
      if (this.workflow.smpl_workflow_is_collection && (!this.currentEntities.subjects[0] || (this.usesCases && !this.currentEntities.cases[0]))) {
        this.$toastNotifier.notifyError(this.usesCases ? 'Please select a subject and a case first.' : 'Please select a subject first.');
        return;
      }
      const subjectId = this.currentEntities.subjects[0]?.id;
      const caseId = this.currentEntities.cases[0]?.id;
      const collectionStep = this.steps.find(step =>
        this.getEventTypeById(step.smpl_event_type_fk)?.smpl_label === "Collection" &&
        !this.getLine(step.smpl_workflow_line_fk)?.smpl_workflow_line_is_kit
      );
      const collectionFormId = collectionStep?.smpl_workflow_step_form_id
        || this.workflow.smpl_workflow_collection_form_id
        || this.getEventTypeByName("Collection")?.smpl_template_form_id;

      let forms = [{
        id: collectionFormId, form: null, isValidForm: true,
        defaultEntity: {
          entitytype_id: this.getEntityType("SMPL_EVENT").id,
          smpl_event_type_fk: this.getEventTypeByName("Collection").id,
          smpl_subject_fk: subjectId,
          smpl_case_fk: caseId,
        }
      }];

      if (this.workflow.smpl_workflow_is_collection) {
        this.workflow.lines.filter(line => line.smpl_workflow_line_is_kit == true).forEach(line => {
          const quantity = this.resolveLineQuantity(line);
          if (quantity === null) return; // ce type de cas ne concerne pas cette ligne
          forms.push({
            id: this.sampleCreationFormId,
            form: null, isValidForm: true,
            title: line.smpl_label,
            defaultEntity: {
              entitytype_id: this.getEntityType("SMPL_CREATION").id,
              smpl_workflow_line_fk: line.id,
              smpl_sample_creation_with_collection: true,
              smpl_workflow_line_quantity: quantity
            }
          });
        });
      }

      this.pipeline.push(forms);
      this.popPipeline();
    },

    standardLineCollection(line) {
      if (this.workflow.smpl_workflow_is_collection && (!this.currentEntities.subjects[0] || (this.usesCases && !this.currentEntities.cases[0]))) {
        this.$toastNotifier.notifyError(this.usesCases ? 'Please select a subject and a case first.' : 'Please select a subject first.');
        return;
      }
      const subjectId = this.currentEntities.subjects[0]?.id;
      const caseId = this.currentEntities.cases[0]?.id;
      const collectionStep = line.steps.find(step =>
        this.getEventTypeById(step.smpl_event_type_fk)?.smpl_label === "Collection"
      );
      const collectionFormId = collectionStep?.smpl_workflow_step_form_id
        || this.workflow.smpl_workflow_collection_form_id
        || this.getEventTypeByName("Collection")?.smpl_template_form_id;

      const lineQuantity = this.workflow.smpl_workflow_is_collection ? this.resolveLineQuantity(line) : null;

      const forms = [
        {
          id: collectionFormId, form: null, isValidForm: true,
          defaultEntity: {
            entitytype_id: this.getEntityType("SMPL_EVENT").id,
            smpl_event_type_fk: this.getEventTypeByName("Collection").id,
            smpl_subject_fk: subjectId,
            smpl_case_fk: caseId,
          }
        },
        // ce type de cas ne concerne pas cette ligne -> pas de ticket de création de samples
        ...(this.workflow.smpl_workflow_is_collection && lineQuantity !== null ? [{
          id: this.sampleCreationFormId,
          form: null, isValidForm: true,
          title: line.smpl_label,
          defaultEntity: {
            entitytype_id: this.getEntityType("SMPL_CREATION").id,
            smpl_workflow_line_fk: line.id,
            smpl_sample_creation_with_collection: true,
            smpl_workflow_line_quantity: lineQuantity
          }
        }] : [])
      ];

      this.pipeline.push(forms);
      this.popPipeline();
    },

    standardEvent(step) {
      let eventType = this.getEventTypeById(step.smpl_event_type_fk);

      if (eventType.smpl_label == "Collection") {
        if (step.smpl_workflow_step_is_batch) {
          const batchSteps = step.steps || [];
          const collectionFormId = batchSteps.find(s => s.smpl_workflow_step_form_id)?.smpl_workflow_step_form_id
            || this.workflow.smpl_workflow_collection_form_id
            || this.getEventTypeByName("Collection")?.smpl_template_form_id;
          const forms = [{
            id: collectionFormId, form: null, isValidForm: true,
            defaultEntity: {
              entitytype_id: this.getEntityType("SMPL_EVENT").id,
              smpl_event_type_fk: this.getEventTypeByName("Collection").id,
              smpl_subject_fk: this.currentEntities.subjects[0]?.id,
              smpl_case_fk: this.currentEntities.cases[0]?.id,
            }
          }];
          if (this.workflow.smpl_workflow_is_collection) batchSteps.forEach(s => {
            const line = this.getLine(s.smpl_workflow_line_fk);
            if (line) {
              const quantity = this.resolveLineQuantity(line);
              if (quantity === null) return; // ce type de cas ne concerne pas cette ligne
              forms.push({
                id: this.sampleCreationFormId, form: null, isValidForm: true,
                title: line.smpl_label,
                defaultEntity: {
                  entitytype_id: this.getEntityType("SMPL_CREATION").id,
                  smpl_workflow_line_fk: line.id,
                  smpl_sample_creation_with_collection: true,
                  smpl_workflow_line_quantity: quantity
                }
              });
            }
          });
          this.pipeline.push(forms);
          this.popPipeline();
        } else {
          this.standardLineCollection(this.getLine(step.smpl_workflow_line_fk));
        }
        return;
      }
      
      let aliasStep = step;
      let actualStep = step;
      
      if (eventType.smpl_is_alias) {
        actualStep = this.getStep(step.smpl_workflow_step_goto_fk);
        eventType = this.getEventTypeById(actualStep.smpl_event_type_fk);
      }

      let batchStep = null;
      
      if (actualStep?.smpl_workflow_step_is_batch) {
        batchStep = actualStep;
      } else if (actualStep?.smpl_workflow_step_batch_fk) {
        batchStep = this.getBatch(actualStep.smpl_workflow_step_batch_fk);
      }

      let forms = [{
        id: actualStep.smpl_workflow_step_form_id, form: null, isValidForm: true,
        title: "New " + (actualStep?.type ? actualStep.type : "Event"),
        defaultEntity: {
          entitytype_id: this.getEntityType("SMPL_EVENT").id,
          smpl_workflow_step_fk: actualStep.id,
          smpl_event_type_fk: eventType.id,
          smpl_workflow_step_alias_fk: batchStep ? null : aliasStep.id
        }
      }];

      if (eventType.smpl_yields_derivative && !actualStep.smpl_workflow_step_is_batch) {
        // resolveLineQuantity() (pas line.smpl_workflow_line_quantity directement) —
        // c'est la seule fonction qui sait résoudre la quantité spécifique au(x)
        // type(s) de cas actif(s) via Line_Case_Type_Quantity. Sans ça, sur un
        // workflow qui utilise des quantités par type de cas, le champ générique
        // de la ligne est vide et le ticket d'aliquot se crée avec une quantité
        // vide — c'est le bug rapporté ("quantity ne sont pas remplis"). Même
        // pattern que standardBatchCollection()/standardLineCollection()/promptNewKit().
        this.workflow.lines.filter(line => line.smpl_workflow_step_fk == actualStep.id).forEach((line, i) => {
          const quantity = this.resolveLineQuantity(line);
          if (quantity === null) return; // ce type de cas ne concerne pas cette ligne
          forms.push({
            id: this.sampleCreationFormId, form: null, isValidForm: true,
            defaultEntity: {
              entitytype_id: this.getEntityType("SMPL_CREATION").id,
              smpl_workflow_line_fk: line.id,
              SMPL_CREATION_with_collection: true,
              smpl_workflow_line_quantity: quantity,
              smpl_order: i
            }
          });
        });
      }

      this.pipeline.unshift(forms);
      this.popPipeline();
    },

    //==========================
    // GESTION DES OPÉRATIONS SUR LES ENTITÉS
    //==========================
    
    async formDispatch() {
      const formData = this.forms.map(form => form.e);

      let subjectData = formData.filter(data => data.entitytype_id == this.getEntityType("SMPL_SUBJECT").id);
      let caseData = formData.filter(data => data.entitytype_id == this.getEntityType("SMPL_CASE").id);

      // Données de collection
      let collectionData = formData
        .filter(data => data.entitytype_id == this.getEntityType("SMPL_EVENT").id)
        .find(data => {
          const eventType = this.getEventTypeById(data.smpl_event_type_fk);
          return eventType?.smpl_label == "Collection";
        });
        
      let derivationData = formData.find(data => {
        return this.getEventTypeById(data.smpl_event_type_fk)?.smpl_yields_derivative;
      });
      
      let storageData = formData
        .filter(data => data.entitytype_id == this.getEntityType("SMPL_EVENT").id)
        .find(data => data?.STORAGE);
        
      const sampleCreation = formData.filter(data => data.entitytype_id == this.getEntityType("SMPL_CREATION").id);

      if (subjectData.length > 0) {
        this.selectSubjects([subjectData[0]]);
      }
      else if (caseData.length > 0) {
        this.selectCases([caseData[0]]);
      }
      else if (collectionData) {
        collectionData.smpl_subject_fk = this.currentEntities.subjects[0]?.id;
        collectionData.smpl_case_fk = this.currentEntities.cases[0]?.id;
        collectionData.smpl_kit_fk = this.currentEntities.kits[0]?.id;

        if (sampleCreation.length > 0) {
          if (this.workflow.smpl_workflow_is_collection) {
            await this.newSpecimens(sampleCreation, collectionData);
          } else {
            // Workflow non-collection : fait avancer des échantillons existants jusqu'à l'étape Collection
            // au lieu d'en créer de nouveaux.
            for (const ticket of sampleCreation) {
              const line = this.getLine(ticket.smpl_workflow_line_fk);
              const collectionStep = line?.steps?.find(step =>
                this.getEventTypeById(step.smpl_event_type_fk)?.smpl_label === "Collection"
              );
              if (collectionStep) {
                await this.sampleEventUpdate({
                  ...collectionData,
                  smpl_workflow_step_fk: collectionStep.id,
                  smpl_collection_start_time: this.COLLECTION_START_TIME_ENABLED ? collectionData.smpl_event_start_time : null
                });
              }
            }
          }
        } else if (!this.workflow.smpl_workflow_is_collection) {
          // is_collection = false et aucun ticket SMPL_CREATION : trouver directement les étapes
          // Collection du workflow et y faire avancer les échantillons existants.
          const collectionSteps = this.steps.filter(step =>
            this.getEventTypeById(step.smpl_event_type_fk)?.smpl_label === "Collection"
          );
          for (const collectionStep of collectionSteps) {
            await this.sampleEventUpdate({
              ...collectionData,
              smpl_workflow_step_fk: collectionStep.id,
              smpl_collection_start_time: this.COLLECTION_START_TIME_ENABLED ? collectionData.smpl_event_start_time : null
            });
          }
        }
      }
      else {
        if (storageData) {
          await this.dapp.$axios.$put(`/entities/${storageData.id}`, { 
            "STORAGE": null, 
            "POSITION_COLUMN": null, 
            "POSITION_ROW": null 
          });
        }

        if (derivationData) {
          if (sampleCreation.length > 0) {
            for (let i = 0; i < sampleCreation.length; i++) {
              const ticket = sampleCreation[i];
              await this.newDerivatives(ticket, derivationData);
            }
          }
        }
        
        for (const form of this.forms.filter(f => f.e?.smpl_event_type_fk)) {
          const data = { ...form.e };

          for (const [key, value] of Object.entries(form.defaultEntity || {})) {
            if ((value === null || value === '' || value === undefined) && !(key in data)) {
              data[key] = null;
            }
          }

          const changedData = this.changedFormValues[form.id]?.e || {};
          for (const [key, value] of Object.entries(changedData)) {
            if (value === null || value === '' || value === undefined) {
              data[key] = null;
            }
          }

          const step = this.getStep(data.smpl_workflow_step_fk);

          // changedData carries exactly the fields the user touched in this form —
          // this is what lets sampleEventUpdate tell "explicitly cleared" apart
          // from "never part of this form" for STORAGE/POSITION_ROW/POSITION_COLUMN.
          if (step?.smpl_workflow_step_is_batch) {
            const steps = step.steps;
            for (let i = 0; i < steps.length; i++) {
              await this.sampleEventUpdate(Object.assign({}, data, { smpl_workflow_step_fk: steps[i].id }), changedData);
            }
          } else {
            await this.sampleEventUpdate(data, changedData);
          }
        }
      }

      this.reloadWorkflow();
      this.popPipeline();
    },
    
    async newSpecimens(tickets, data) {
      // Ticket keys that are structural/internal to the creation prompt itself and
      // must never be copied onto the new sample entity as a custom field.
      const CREATION_FIELDS = new Set([
        'entitytype_id', 'id',
        'smpl_workflow_line_fk', 'smpl_workflow_line_quantity',
        'smpl_barcodes', 'smpl_order',
        'SMPL_CREATION_with_collection', 'SMPL_CREATION_with_container',
        'smpl_sample_creation_with_collection'
      ]);

      let createData = [];
      
      for (let j = 0; j < tickets.length; j++) {
        const ticket = tickets[j];
        const line = this.getLine(ticket.smpl_workflow_line_fk);
        const barcodes = ticket.smpl_barcodes ? ticket.smpl_barcodes.split(/[\s,\r\n\t]+/) : null;
        const quantity = ticket.smpl_workflow_line_quantity;

        // chuv_content_volume_unit (Molis-specific unit) takes precedence over the
        // generic smpl_volume_unit when present; harmless no-op on sites without it.
        const resolvedVolumeUnit_ns = line?.chuv_content_volume_unit || line?.smpl_volume_unit || this.getChoiceId("smpl_volume_unit_category", "ml");

        for (let i = 0; i < (barcodes ? barcodes.length : quantity); i++) {
          const entity = {
            entitytype_id: this.getEntityType("SMPL_SAMPLE").id,
            smpl_events_fk: [data.id],
            smpl_collection_fk: data.entitytype_id == this.getEntityType("SMPL_COLLECTION").id ? data.id : null,
            BARCODE: (barcodes ? barcodes[i] : null),
            smpl_subject_fk: data?.smpl_subject_fk,
            smpl_case_fk: data?.smpl_case_fk,
            smpl_kit_fk: data.smpl_kit_fk,
            smpl_study_fk: this.workflow.smpl_study_fk,
            // Tableau — voir commentaire dans promptNewSubject (champ smpl_workflow_fk partagé, multiple partout).
            smpl_workflow_fk: [this.workflow.id],
            smpl_workflow_line_fk: line.id,
            smpl_container_type_fk: line?.smpl_container_type_fk,
            smpl_container_volume: line?.smpl_container_volume,
            smpl_sample_type_fk: line?.smpl_sample_type_fk,
            smpl_content_volume: line?.smpl_content_volume ? line.smpl_content_volume : null,
            smpl_volume_unit: resolvedVolumeUnit_ns,
            chuv_container_volume_unit: line?.chuv_container_volume_unit,
            chuv_content_volume_unit: line?.chuv_content_volume_unit,
            chuv_cell_count: line?.chuv_cell_count,
            chuv_cell_count_unit: line?.chuv_cell_count_unit,
            smpl_collection_start_time: this.COLLECTION_START_TIME_ENABLED && ticket.smpl_sample_creation_with_collection ? data?.smpl_event_start_time : null,
            smpl_sample_status_fk: ticket.smpl_sample_creation_with_collection ? this.getStatusId("Collected") : this.getStatusId("Created"),
            smpl_workflow_step_fk: ticket.smpl_sample_creation_with_collection ? line.steps[1].id : line.steps[0].id,
            smpl_order: i
          };

          // Pass through any extra/custom field the user added to the sample-creation
          // form (ticket) that isn't one of the structural keys above and has a value.
          for (const [key, value] of Object.entries(ticket)) {
            if (!CREATION_FIELDS.has(key) && value !== null && value !== undefined && value !== '') {
              entity[key] = value;
            }
          }
          
          if (line.smpl_id_gen_fk) {
            const template = await this.getEntity(line.smpl_id_gen_fk);
            const idAssembly = await this.dapp.$axios.$post(await this.getRouteURLByName('smpl_generate_id'), { entity: entity, template: template });
            
            entity.smpl_id_stem = idAssembly.stem ? idAssembly.stem : "undefined";
            entity.smpl_id_nb = idAssembly.nb;
            entity.smpl_id = idAssembly.id;
          }

          createData.push(entity);
        }
      }
      
      await this.batchCreate(createData);
      await this.batchDelete(tickets);
    },
    
    async newDerivatives(ticket, data) {
      // Same structural/internal ticket keys as newSpecimens — never copied as custom fields.
      const CREATION_FIELDS = new Set([
        'entitytype_id', 'id',
        'smpl_workflow_line_fk', 'smpl_workflow_line_quantity',
        'smpl_barcodes', 'smpl_order',
        'SMPL_CREATION_with_collection', 'SMPL_CREATION_with_container',
        'smpl_sample_creation_with_collection'
      ]);

      const step = this.getStep(data.smpl_workflow_step_fk);
      const line = this.getLine(ticket.smpl_workflow_line_fk);
      const barcodes = ticket.smpl_barcodes ? ticket.smpl_barcodes.split(/[\s,\r\n\t]+/) : null;
      const quantity = ticket.smpl_workflow_line_quantity;
      
      let samples = this.currentEntities.samples
        .filter(sample => step.prevSteps.includes(sample.smpl_workflow_step_fk))
        .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
        .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
        .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true);

      let createData = [];

      // chuv_content_volume_unit (Molis-specific unit) takes precedence over the
      // generic smpl_volume_unit when present; harmless no-op on sites without it.
      const resolvedVolumeUnit_nd = line?.chuv_content_volume_unit || line?.smpl_volume_unit || this.getChoiceId("smpl_volume_unit_category", "ml");

      for (let j = 0; j < samples.length; j++) {
        const parentSample = samples[j];
        for (let i = 0; i < quantity; i++) {
          const entity = {
            entitytype_id: this.getEntityType("SMPL_SAMPLE").id,
            smpl_events_fk: data.smpl_inherits ? parentSample.smpl_events_fk : [data.id],
            BARCODE: barcodes ? (barcodes[j * quantity + i] || null) : null,
            smpl_subject_fk: parentSample?.smpl_subject_fk,
            smpl_case_fk: parentSample?.smpl_case_fk,
            smpl_kit_fk: parentSample?.smpl_kit_fk,
            smpl_study_fk: this.workflow.smpl_study_fk,
            // Tableau — voir commentaire dans promptNewSubject (champ smpl_workflow_fk partagé, multiple partout).
            smpl_workflow_fk: [this.workflow.id],
            smpl_workflow_line_fk: line.id,
            smpl_sample_fk: parentSample.id,
            smpl_container_type_fk: line?.smpl_container_type_fk,
            smpl_container_volume: line?.smpl_container_volume,
            smpl_sample_type_fk: line?.smpl_sample_type_fk,
            smpl_content_volume: line?.smpl_content_volume ? line.smpl_content_volume : null,
            smpl_volume_unit: resolvedVolumeUnit_nd,
            chuv_container_volume_unit: line?.chuv_container_volume_unit,
            chuv_content_volume_unit: line?.chuv_content_volume_unit,
            chuv_cell_count: line?.chuv_cell_count,
            chuv_cell_count_unit: line?.chuv_cell_count_unit,
            smpl_collection_start_time: this.COLLECTION_START_TIME_ENABLED ? parentSample?.smpl_collection_start_time : null,
            smpl_sample_status_fk: this.getStatusId("Allocated"),
            smpl_workflow_step_fk: line.steps[1].id,
            smpl_order: i
          };

          // Pass through any extra/custom field from the derivative creation ticket,
          // same rule as newSpecimens: skip structural keys and empty values.
          for (const [key, value] of Object.entries(ticket)) {
            if (!CREATION_FIELDS.has(key) && value !== null && value !== undefined && value !== '') {
              entity[key] = value;
            }
          }

          if (line.smpl_id_gen_fk) {
            const template = await this.getEntity(line.smpl_id_gen_fk);
            const idAssembly = await this.dapp.$axios.$post(await this.getRouteURLByName('smpl_generate_id'), { entity: entity, template: template });

            entity.smpl_id_stem = idAssembly.stem ? idAssembly.stem : "undefined";
            entity.smpl_id_nb = idAssembly.nb;
            entity.smpl_id = idAssembly.id;
          }

          createData.push(entity);
        }
      }
      
      await this.batchCreate(createData);
    },
    
    async sampleEventUpdate(data, changedFields = {}) {
      let step = this.getStep(data.smpl_workflow_step_fk);

      let unit, consumedVolumeInMl = 0;
      if (data.smpl_consumed_volume && data.smpl_volume_unit) {
        unit = this.getChoiceDescription(data.smpl_volume_unit);
        consumedVolumeInMl = data.smpl_consumed_volume * unit;
      }

      const sampleStep = data?.smpl_workflow_step_alias_fk ? this.getStep(data.smpl_workflow_step_alias_fk) : step;

      let samples = this.currentEntities.samples
        .filter(sample => sampleStep.prevSteps.includes(sample.smpl_workflow_step_fk))
        .filter(sample => this.currentEntities.subjects.length > 0 ? this.currentEntities.subjects.find(subject => subject.id == sample.smpl_subject_fk) || !sample.smpl_subject_fk : true)
        .filter(sample => this.currentEntities.cases.length > 0 ? this.currentEntities.cases.find(casus => casus.id == sample.smpl_case_fk) || !sample.smpl_case_fk : true)
        .filter(sample => this.currentEntities.kits.length > 0 ? this.currentEntities.kits.find(kit => kit.id == sample.smpl_kit_fk) || !sample.smpl_kit_fk : true);

      // Storage-related fields get special handling: they should only be copied
      // onto the sample when the user actually touched them in the event form
      // (present in changedFields) — whether they left them blank (explicit clear)
      // or filled them in. If the field wasn't part of what the user changed,
      // the sample's existing STORAGE/position is left completely untouched,
      // even though the field's value in `data` is null/undefined by default.
      const STORAGE_FIELDS = ["STORAGE", "POSITION_ROW", "POSITION_COLUMN"];

      samples.forEach(sample => {
        //remaining volume calculation
        let sampleVolumeUnit;
        let smpl_content_volume = 0;
        let contentVolumeInMl = 0;

        // chuv_content_volume_unit (Molis-specific unit) takes precedence over the
        // generic smpl_volume_unit when present; harmless no-op on sites without it.
        const resolvedVolumeUnit = sample.chuv_content_volume_unit || sample.smpl_volume_unit;

        if (sample.smpl_content_volume && resolvedVolumeUnit) {
          sampleVolumeUnit = this.getChoiceDescription(resolvedVolumeUnit);
          if (sampleVolumeUnit) {
            contentVolumeInMl = Math.max(sample.smpl_content_volume * sampleVolumeUnit - consumedVolumeInMl, 0);
            smpl_content_volume = contentVolumeInMl / sampleVolumeUnit;
          } else {
            smpl_content_volume = sample.smpl_content_volume;
          }
        } else {
          smpl_content_volume = sample.smpl_content_volume;
        }

        const stopFields = ["smpl_volume_unit", "id", "entitytype_id"];
        const sampleFields = this.getEntityType("SMPL_SAMPLE")._fields;

        for (const [key, value] of Object.entries(data)) {
          const sampleField = sampleFields.find(sampleField => sampleField.name == key);
          const isStorageField = STORAGE_FIELDS.includes(key);

          // Storage fields: only copy if the user actually touched this field in
          // the form (present in changedFields), regardless of value (blank = clear).
          // Everything else keeps the original "skip nulls" rule.
          const copied = isStorageField
            ? (sampleField && (key in changedFields))
            : (sampleField && !stopFields.includes(key) && value != null);

          if (copied) {
            sample[key] = value;
          }
        }

        sample.smpl_workflow_step_fk = step.id;
        sample.smpl_events_fk = (sample.smpl_events_fk || []).concat(data.id);
        sample.smpl_sample_status_fk = step.smpl_sample_status_fk;
        sample.smpl_content_volume = smpl_content_volume;
      });

      if (samples.length > 0) await this.batchUpdate(samples);
    },
    
    async propagate(e, samples = []) {
      let step = this.getStep(e.smpl_workflow_step_fk);
      let batch = step?.smpl_workflow_step_is_batch ? this.getStep(e.smpl_workflow_step_fk) : null;

      let unit, consumedVolumeInMl = 0;
      if (e.smpl_consumed_volume && e.smpl_volume_unit) {
        unit = this.getChoiceDescription(e.smpl_volume_unit);
        consumedVolumeInMl = e.smpl_consumed_volume * unit;
      }

      let typeEvent = "Collection";
      if (step) typeEvent = batch ? this.getEventTypeByName(step.steps[0].type) : this.getEventTypeByName(step.type);

      for (let i = 0; i < samples.length; i++) {
        const sampleID = samples[i];
        const parentSample = await this.getEntity(sampleID);
        
        let parentSampleVolumeUnit;
        let smpl_content_volume = 0;
        let contentVolumeInMl = 0;

        // chuv_content_volume_unit (Molis-specific unit) takes precedence over the
        // generic smpl_volume_unit when present; harmless no-op on sites without it.
        const resolvedParentUnit = parentSample.chuv_content_volume_unit || parentSample.smpl_volume_unit;
        if (parentSample.smpl_content_volume && resolvedParentUnit) {
          parentSampleVolumeUnit = this.getChoiceDescription(resolvedParentUnit);
          contentVolumeInMl = Math.max(parentSample.smpl_content_volume * parentSampleVolumeUnit - consumedVolumeInMl, 0);
          smpl_content_volume = contentVolumeInMl / parentSampleVolumeUnit;
        }

        const sampleForEvents = await this.getEntity(sampleID);
        let sampleEvents = [];
        
        if (sampleForEvents?.smpl_events_fk) {
          sampleEvents = sampleForEvents.smpl_events_fk;
        }
        
        sampleEvents.push(e.id);

        if (batch) {
          const lineID = this.currentEntities.samples.find(sample => sample.id == sampleID).smpl_workflow_line_fk;
          step = batch.steps.find(step => step.smpl_workflow_line_fk == lineID);
        }

        let sampleUpdate = {
          "smpl_content_volume": smpl_content_volume,
          "smpl_workflow_step_fk": e.smpl_workflow_step_fk,
          "smpl_events_fk": sampleEvents
        };
        
        if (batch) sampleUpdate.smpl_workflow_step_fk = step.id;
        
        if (step.smpl_sample_status_fk) {
          sampleUpdate.smpl_sample_status_fk = (step.smpl_workflow_step_status_change_fk ? step.smpl_workflow_step_status_change_fk : step.smpl_sample_status_fk);
        }

        // Storage fields: only applied if explicitly present on the submitted
        // event data (e), matching the same "explicit touch required" rule as
        // sampleEventUpdate(). No more blanket clearing on every non-Storage event.
        if ('STORAGE' in e) sampleUpdate.STORAGE = e.STORAGE === '' ? null : e.STORAGE;
        if ('POSITION_COLUMN' in e) sampleUpdate.POSITION_COLUMN = e.POSITION_COLUMN === '' ? null : e.POSITION_COLUMN;
        if ('POSITION_ROW' in e) sampleUpdate.POSITION_ROW = e.POSITION_ROW === '' ? null : e.POSITION_ROW;

        const sample = await this.dapp.$axios.$put(`/entities/${sampleID}`, sampleUpdate);
        this.selectSamples([sample]);
      }
    },
    
    async batchCreate(createData) {
      const params = {
        data: createData,
        options: {},
        async: false,
        save_changes: true,
      };
      
      try {
        await this.$axios.$post('entities/batch', params);
      } catch (error) {
      }
    },
    
    async batchUpdate(updateData) {
      const params = {
        data: updateData,
        options: {
          identify_entities_by: ['id'],
          upsert: false
        },
        async: false,
        save_changes: true,
      };
      
      try {
        await this.$axios.$put('entities/batch', params);
      } catch (error) {
      }
    },
    
    async batchDelete(deleteData) {
      for (let i = 0; i < deleteData.length; i++) {
        await this.dapp.$axios.$delete(`/entities/${deleteData[i].id}`);
      }
    },
    
    exceptionHandler(error) {
      this.dapp.$store.dispatch('exceptionHandler', error);
    },

    //==========================
    // INITIALISATION
    //==========================
    
    async init() {
      if (!d3.select("#bonhomme").empty()) return;
      const bonhomme = d3.select("#nodeLayer").append("g").attr("id", "bonhomme");

      bonhomme.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0.78 * this.grid.step[1])
        .attr("y2", 0.78 * this.grid.step[1])
        .attr('stroke', "#98A2B3")
        .attr('stroke-width', 3)
        .style("stroke-dasharray", "0, 6")
        .style('stroke-linecap', 'round');

      bonhomme.append("text")
        .attr("id", "bonhommeSubject")
        .attr("fill", "#041E42")
        .style("font-family", "'Urbanist', sans-serif")
        .style("text-anchor", "start")
        .style("font-size", "1.4em")
        .style("font-weight", 700)
        .style("cursor", "default")
        .attr('x', -10)
        .attr('y', - 0.55 * this.grid.step[1])
        .html("No subject selected")
        .on("click", this.showCustomViewForSubjects);

      if (this.usesCases) {
        bonhomme.append("text")
          .attr("id", "bonhommeCase")
          .style("font-size", "1.2em")
          .style("cursor", "default")
          .attr("fill", "#041E42")
          .style("font-family", "'Urbanist', sans-serif")
          .style("text-anchor", "start")
          .style("font-weight", "500")
          .attr("x", -10)
          .attr("y", - 0.55 * this.grid.step[1])
          .attr("dy", "1.4em")
          .html("No case selected")
          .on("click", this.showCustomViewForCases);
      }

      bonhomme.append("circle")
        .attr("cx", 0).attr("cy", 0).attr("r", 22)
        .style("fill", "white")
        .style("stroke", "#0072CE")
        .style("stroke-width", 3);

      bonhomme.append("image").attr("xlink:href", this.resources["person"])
        .attr("fill", "black")
        .attr("x", -15).attr("y", -15)
        .attr("width", 30)
        .attr("height", 30);

      bonhomme.append("text").attr("id", "bonhommeContainers")
        .attr("fill", "#475467")
        .style("font-family", "'IBM Plex Sans', sans-serif")
        .style("text-anchor", "start")
        .style("font-size", "0.7em")
        .style("cursor", "default")
        .attr('x', 30)
        .attr('y', -13)
        .text("Use new containers");

      bonhomme.append("text").attr("id", "bonhommeCollect")
        .attr("fill", "dimGrey")
        .style("text-anchor", "start")
        .style("font-weight", "700")
        .style("cursor", "pointer")
        .attr('x', 30)
        .attr('y', 6)
        .text("Collection")
        .on("click", async (e, d) => {
          if (d3.select("#bonhommeCollect").classed("active")) {
            if (this.currentEntities.subjects.length == 0)
              this.promptNewSubject();
            else if (this.currentEntities.subjects.length == 1 && this.usesCases && this.currentEntities.cases.length == 0)
              this.promptNewCase();
            else if (this.currentEntities.subjects.length == 1 && (!this.usesCases || this.currentEntities.cases.length == 1))
              this.standardBatchCollection();
          }
        });
    },
    
async loadWorkflow(wfid) {
  const tStart = performance.now();
  // Reset d3Cache : le SVG peut être re-rendu lors d'un changement de workflow
  this.d3Cache = null;
  // Un changement de workflow change l'ensemble des types de cas pertinents —
  // un filtre venant du workflow précédent n'a plus de sens ici.
  this.selectedCaseTypeFilter = null;
  // Vidé à chaque changement de workflow pour ne pas grossir indéfiniment sur
  // une longue session — se remplit à nouveau à la demande (voir
  // filterSamplesByCaseType()), coût négligeable (juste quelques getEntity()
  // sur les cases réellement rencontrées dans ce nouveau workflow).
  this.caseTypeByCaseId = new Map();
  // Referme le menu "Case type" s'il était ouvert (le workflow précédent n'a
  // plus de toolbar affichée) et retire l'écouteur de clic extérieur associé.
  if (this.caseTypeDropdownOpen && this._closeCaseTypeDropdownOnOutsideClick) {
    document.removeEventListener('click', this._closeCaseTypeDropdownOnOutsideClick);
  }
  this.caseTypeDropdownOpen = false;

  // Lancé ICI, AVANT même le fetch du workflow : les deux gros GET /entities de
  // prefetchCaseTypeEntities() (~1000ms au total) n'ont besoin d'aucune donnée du
  // workflow avant leur étape de regroupement/scoping, qui n'arrive que bien plus
  // loin dans cette fonction. Les lancer maintenant les fait chevaucher avec les
  // ~1.9s d'attente du fetch principal ci-dessous au lieu de s'additionner après.
  const caseTypePrefetch = this.prefetchCaseTypeEntities();

  const tFetch = performance.now();
  this.workflow = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_load_workflow') + '&workflowId=' + wfid);
  console.log(`[perf] loadWorkflow: smpl_load_workflow fetch took ${(performance.now() - tFetch).toFixed(0)}ms (${this.workflow.lines.length} lines)`);

  // ✅ DIAGNOSTIC COMPLET DU WORKFLOW
  
  // ✅ DIAGNOSTIC DES LIGNES
  let problemLines = [];
  
  this.workflow.lines.forEach((line, index) => {
    const stepsCount = line.steps?.length || 0;
    const hasParent = !!line.smpl_workflow_line_fk;
    const isKit = line.smpl_workflow_line_is_kit;
    
    const lineInfo = {
      index: index,
      id: line.id,
      label: line.smpl_label,
      stepsCount: stepsCount,
      steps: line.steps?.map(s => ({
        id: s.id,
        order: s.smpl_order,
        type: s.type,
        label: s.smpl_label
      })),
      isKit: isKit,
      hasParent: hasParent,
      parentStepId: line.smpl_workflow_step_fk,
      visible: line.visible
    };
    
    
    // Identifier les problèmes
    if (stepsCount < 2) {
      problemLines.push({
        ...lineInfo,
        problem: `Only ${stepsCount} step(s), needs at least 2`
      });
    }
    
    if (stepsCount === 0) {
    }
    
    if (hasParent && !this.getStep(line.smpl_workflow_step_fk)) {
      problemLines.push({
        ...lineInfo,
        problem: `Parent step ${line.smpl_workflow_step_fk} not found`
      });
    }
  });
  
  // ✅ RÉSUMÉ DES PROBLÈMES
  if (problemLines.length > 0) {
  } else {
  }
  
  // Traitement des lignes et étapes
  let reorderCount = 0;
  this.workflow.lines.forEach(async line => {
    line.visible = line.smpl_workflow_line_fk ? false : true;
    if (!this.workflow.smpl_workflow_show_hierarchy) line.visible = true;

    line.steps.forEach(async (step, i) => {
      const old_order = step?.smpl_order;
      step.smpl_order = i;
      if (old_order != i) {
        reorderCount++;
        await this.$axios.$put(`entities/${step.id}`, step);
      }
      step.prevSteps = this.getPrevSteps(step);
    });
  });
  if (reorderCount > 0) console.log(`[perf] loadWorkflow: ${reorderCount} step reorder PUT request(s) fired in background (not awaited, don't block the loading screen)`);

  // Charger les quantités par type de cas (Line_Case_Type_Quantity) pour ce workflow.
  // On lui passe caseTypePrefetch : ses deux requêtes tournent déjà depuis le tout
  // début de loadWorkflow(), pas de nouveau fetch lancé ici.
  const tCaseType = performance.now();
  await this.loadLineCaseTypeQuantities(caseTypePrefetch);
  console.log(`[perf] loadWorkflow: loadLineCaseTypeQuantities() took ${(performance.now() - tCaseType).toFixed(0)}ms`);

  // Attendu (contrairement à avant) : sans await ici, updateCounts() — son fetch
  // getSamples() + le rendu D3 complet, ~2.2s mesurés — continuait de tourner en
  // arrière-plan APRÈS que mounted() ait déjà mis loadingProgress à 100% et masqué
  // l'écran de chargement. Résultat : le spinner disparaissait, puis l'appli restait
  // visuellement "vide/figée" encore 1 à 2 secondes pendant que le graphe finissait de
  // se dessiner — donnant l'impression que le chargement "prenait plus de temps que prévu"
  // alors qu'aucune animation n'était en cause, juste ce travail caché après la barre à 100%.
  await this.updateCounts();

  // Gérer l'affichage du bonhomme selon le type de workflow
  if (this.workflow.smpl_workflow_is_collection) {
    d3.select("#nodeLayer").select("#bonhomme").style("visibility", "visible");
  } else {
    d3.select("#nodeLayer").select("#bonhomme").style("visibility", "hidden");
  }
  
  // Réinitialiser le zoom
  this.getCanvasSvg().transition().call(this.zoom.transform, d3.zoomIdentity.translate(this.grid.origin[0], this.grid.origin[1]).scale(this.zoomScale));

  console.log(`[perf] loadWorkflow: TOTAL (updateCounts inclus, graphe réellement affiché) ${(performance.now() - tStart).toFixed(0)}ms`);
},
    
    async reloadWorkflow() {
      // Sauvegarde l'état de visibilité des lignes
      let lineVisibility = {};
      this.workflow.lines.forEach(line => {
        lineVisibility[line.id] = line?.visible;
      });
      
      // Recharge le workflow
      this.workflow = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_load_workflow') + '&workflowId=' + this.workflow.id);
      
      // Restaure l'état de visibilité et calcule les étapes précédentes
      this.workflow.lines.forEach(line => {
        line.visible = lineVisibility[line.id];
        line.steps.forEach(step => {
          step.prevSteps = this.getPrevSteps(step);
        });
      });

      // this.workflow.lines vient d'être entièrement remplacé par de nouveaux objets —
      // il faut recharger les quantités par type de cas dessus, sinon resolveLineQuantity()
      // retombe silencieusement sur la quantité par défaut de la ligne (caseTypeQuantities absent).
      await this.loadLineCaseTypeQuantities();

      // Mise à jour des compteurs
      this.updateCounts();
    },

    // Side bar de navigation — mêmes clés localStorage que smpl config, mais
    // préfixées différemment (smpl* vs smplConfig*) pour ne jamais mélanger les
    // favoris/l'état épinglé des deux outils.
    loadSidebarPreferences() {
      try {
        const pinned = localStorage.getItem('smplSidebarPinned');
        this.sidebarPinned = pinned === 'true';
        this.sidebarCollapsed = !this.sidebarPinned;
        const favorites = localStorage.getItem('smplFavoriteWorkflows');
        this.favoriteWorkflowIds = favorites ? JSON.parse(favorites) : [];
      } catch (e) {
        this.sidebarPinned = false;
        this.sidebarCollapsed = true;
        this.favoriteWorkflowIds = [];
      }
    },
    toggleSidebarPin() {
      this.sidebarPinned = !this.sidebarPinned;
      try { localStorage.setItem('smplSidebarPinned', this.sidebarPinned ? 'true' : 'false'); } catch (e) {}
      if (!this.sidebarPinned) this.sidebarCollapsed = true;
    },
    toggleFavoriteWorkflow(id, event) {
      if (event) event.stopPropagation();
      const idx = this.favoriteWorkflowIds.indexOf(id);
      if (idx === -1) this.favoriteWorkflowIds.push(id);
      else this.favoriteWorkflowIds.splice(idx, 1);
      try { localStorage.setItem('smplFavoriteWorkflows', JSON.stringify(this.favoriteWorkflowIds)); } catch (e) {}
    },
    // Cycle à 3 états par colonne : pas encore la colonne active -> descendant ;
    // déjà descendant sur cette colonne -> ascendant ; déjà ascendant -> plus
    // aucun tri (sidebarSortField = null, retour à l'ordre par défaut).
    toggleSidebarSort(field) {
      if (this.sidebarSortField !== field) {
        this.sidebarSortField = field;
        this.sidebarSortDir = 'desc';
      } else if (this.sidebarSortDir === 'desc') {
        this.sidebarSortDir = 'asc';
      } else {
        this.sidebarSortField = null;
      }
    },
    async selectWorkflow(id) {
      await this.loadWorkflow(id);
      if (!this.sidebarPinned) this.sidebarCollapsed = true;
    },
  },

  watch: {
    // Le canvas SVG doit se redimensionner dès que la side bar s'ouvre/se ferme,
    // sinon il reste calé sur l'ancienne largeur jusqu'au prochain resize navigateur.
    sidebarCollapsed() {
      this.onResize();
    },
  },

  // CYCLE DE VIE DU COMPOSANT
  
    async mounted() {
      this.loadSidebarPreferences();

      // Timing global de mounted() — voir tous les logs [perf] dans la console pour
      // savoir laquelle des 5 étapes (et laquelle des requêtes réseau à l'intérieur)
      // domine réellement le temps passé sur l'écran de chargement.
      this._perfStart = performance.now();
      this._perfLast = this._perfStart;
      const perfStep = (label) => {
        const now = performance.now();
        console.log(`[perf] mounted: ${label} — step took ${(now - this._perfLast).toFixed(0)}ms, total elapsed ${(now - this._perfStart).toFixed(0)}ms`);
        this._perfLast = now;
      };

      try {
        this.loading = true;
        this.loadingProgress = 0;

        // Step 1: Resources (20%)
        this.loadingMessage = this.loadingSteps[0];
        const resources = [
          { key: "d3", name: "d3.min.js" },
          { key: "batch", name: "batch.svg" },
          { key: "person", name: "person.svg" },
          { key: "branches_hide", name: "branches_hide.png" },
          { key: "branches_show", name: "branches_show.png" },
          { key: "SMPL_logo_2", name: "SMPL_logo_2.png" },
          { key: "LOGO_SBP", name: "LOGO_SBP.svg" }
        ]
        await this.getResources(resources)
        perfStep('Step 1 (getResources) done');
        this.loadingProgress = 20;
        this.updateLoadingProgress(1);

        // Step 2: Environment (40%)
        this.loadingMessage = this.loadingSteps[1];
        const d3url = this.resources["d3"]
        const d3response = await fetch(d3url)
        const d3code = await d3response.text()
        perfStep('Step 2a (fetch d3.min.js source)');
        const d3blob = new Blob([d3code], { type: 'application/javascript' })
        const d3blobUrl = URL.createObjectURL(d3blob)
        await this.registerLib({ url: d3blobUrl })
        URL.revokeObjectURL(d3blobUrl)
        perfStep('Step 2b (registerLib d3)');
        this.$nextTick(() => {
          window.addEventListener('resize', this.onResize);
        })
        this.zoom = d3.zoom().scaleExtent([0.1, 2]).on('zoom', this.handleZoom)
        this.initZoom()
        await this.setFormIds()
        perfStep('Step 2c (setFormIds)');
        this.loadingProgress = 40;
        this.updateLoadingProgress(2);

        // Process URL parameters
        let uri = window.location.href.split('?')
        this.currentProject = uri[0].match(/workspaces\/(\d+)/)
        if (!this.currentProject) this.currentProject = "global"
        else this.currentProject = this.currentProject[1]
        let desiredWorkflow
        if (uri.length == 2) {
          let vars = uri[1].split('&')
          let getVars = {}
          let tmp = ''
          vars.forEach(function (v) {
            tmp = v.split('=')
            if (tmp.length == 2)
              getVars[tmp[0]] = tmp[1]
          });
          desiredWorkflow = getVars?.workflow
        }

        // Step 3: Workflows (60%)
        this.loadingMessage = this.loadingSteps[2];
        await this.getAllWorkflows(desiredWorkflow)
        perfStep('Step 3a (getAllWorkflows)');
        this.getAllEntityTypes()
        perfStep('Step 3b (getAllEntityTypes)');
        this.loadingProgress = 60;
        this.updateLoadingProgress(3);

        // Step 4: Interface (80%)
        this.loadingMessage = this.loadingSteps[3];
        this.init()
        const favoriteWorkflow = this.workflows.find(wf => this.favoriteWorkflowIds.includes(wf.id))
        await this.loadWorkflow(favoriteWorkflow ? favoriteWorkflow.id : this.workflows[0].id)
        perfStep('Step 4 (init + loadWorkflow, updateCounts inclus — le graphe est réellement affiché à ce stade)');
        this.loadingProgress = 80;
        this.updateLoadingProgress(4);

        // Step 5: Final setup (100%)
        this.loadingMessage = this.loadingSteps[4];
        this.applyCssStyle()
        this.onResize()
        const customviews = await this.dapp.$axios.$get('/customviews')
        perfStep('Step 5 (customviews fetch)');
        this.customViewIds.samples = customviews.find(cv => cv.name == "smpl")?.id
        if (!this.customViewIds.samples) this.customViewIds.samples = customviews.find(cv => cv.name == "smpl_global")?.id
        this.customViewIds.subjects = customviews.find(cv => cv.name == "smpl_subjects")?.id
        if (!this.customViewIds.subjects) this.customViewIds.subjects = customviews.find(cv => cv.name == "smpl_subjects_global")?.id
        this.customViewIds.cases = customviews.find(cv => cv.name == "smpl_cases")?.id
        if (!this.customViewIds.cases) this.customViewIds.cases = customviews.find(cv => cv.name == "smpl_cases_global")?.id
        this.customViewIds.kits = customviews.find(cv => cv.name == "smpl_kits")?.id
        if (!this.customViewIds.kits) this.customViewIds.kits = customviews.find(cv => cv.name == "smpl_kits_global")?.id

        this.loadingProgress = 100;
        this.loadingMessage = "Complete";
        console.log(`[perf] mounted: TOTAL before the 300ms cosmetic delay = ${(performance.now() - this._perfStart).toFixed(0)}ms`);

        setTimeout(() => {
          this.loading = false;
        }, 300);

      } catch (error) {
        this.loadingMessage = "Error: " + error.message;
      }
    },
    beforeDestroy() {
      window.removeEventListener('resize', this.onResize);
    },
}