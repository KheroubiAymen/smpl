// =============================================
// VERSION — modifier ici uniquement
// =============================================

{
  data() {
    return {
      links: [],
      workflow: null,
      workflows: [],
      steps: [],
      entityTypes: [],
      eventTypes: [],
      width: 100,
      height: 100,
      grid: {
        "origin": [100, 150],
        "step": [320, 160]
      },
      zoom: null,
      zoomScale: 1,
      loading: false,
      formIdToEdit: null,
      creatingForm: false,
      forms: [],
      stepFormId: null,
      lineFormId: null,
      workflowFormId: null,
      subjectFormId: null,
      caseFormId: null,
      kitFormId: null,
      sampleLineFormId: null,
      collectionFormId: null,
      caseTypeFormId: null,
      eventFormTemplates: {},
      selectedStep: null,
      allSampleCustomViews: [],
      stepCustomViewPopup: null,

      // Popup "Form for this batch" — le VRAI form de collecte utilisé plus
      // tard dans smpl normal (smpl_workflow_step_form_id), pas le form
      // d'édition des champs de l'étape/batch. Voir openBatchFormPopup().
      batchFormEntity: null,

      // Side bar (rétractable, fermé par défaut sauf si épinglé — voir
      // sidebarPinned) pour naviguer d'un workflow à l'autre — remplace le
      // dropdown de la toolbar. Le premier workflow se charge automatiquement
      // à l'ouverture (voir mounted()), plus d'écran de sélection intermédiaire.
      sidebarCollapsed: true,
      sidebarSearch: '',
      // Persisté en local (localStorage) — épingler garde le side bar ouvert
      // d'une session à l'autre au lieu de repartir replié par défaut.
      sidebarPinned: false,
      // Tri à 3 états de la liste plate du side bar, par colonne ('name' ou
      // 'date' — proxy: id, pas de date d'écriture exposée par
      // smpl_get_all_workflows) : null = pas de tri (ordre par défaut de la
      // liste) -> 1er clic sur une colonne = descendant -> 2e clic = ascendant
      // -> 3e clic = retour à null. Voir toggleSidebarSort().
      sidebarSortField: null,
      sidebarSortDir: 'desc',
      // Favoris CÔTÉ CONFIG uniquement (localStorage, clé dédiée) — délibérément
      // séparés des favoris SMPL côté utilisateur final, qui vivent ailleurs
      // (autre store/entité) et n'ont pas de rapport avec ce outil de configuration.
      favoriteWorkflowIds: [],

      // Choix "Create new form" / "Use existing form" — utilisé à la fois par le
      // modal de création d'étape (EntitiesCreatorForm) et par le modal d'édition
      // d'une étape existante sans form (EntityUpdateForm) : les deux ne sont
      // jamais ouverts en même temps, donc cet état partagé est sans risque.
      // null = aucun choix fait encore -> AUCUNE action au submit (pas de form du
      // tout). Le but de cette fonctionnalité est justement d'arrêter de créer un
      // form pour chaque étape par défaut — donc pas de valeur par défaut ici,
      // l'utilisateur doit cliquer explicitement un des deux boutons.
      newStepFormMode: null,
      newStepExistingFormId: null,
      newStepFormSearch: '',
      reusableStepForms: [],
      loadingReusableForms: false,

      // Wizard de création de workflow (Subject -> Case -> Kit -> Collection),
      // déclenché juste après la création d'un nouveau workflow — voir
      // startWorkflowWizard(). Un form à la fois, "Next" puis "Submit" à la
      // toute dernière étape. Réutilise le même principe "Create new form" /
      // "Use existing form" que les steps, mais ciblant les champs de form du
      // workflow (smpl_workflow_subject_form_id, etc.) au lieu d'une step.
      workflowWizard: null, // { step: 'subject'|'case'|'kit'|'collection', workflowId }
      wizardStepOrder: ['subject', 'case', 'kit', 'collection'],
      workflowWizardStepEnabled: true, // case à cocher "uses cases"/"uses kits" (Case/Kit seulement)
      newWizardFormMode: null,
      newWizardExistingFormId: null,
      newWizardFormSearch: '',
      reusableWizardForms: [],
      loadingReusableWizardForms: false,
      // true seulement entre le moment où "Create new form" vient de dupliquer
      // le template et l'ouverture de son éditeur (submitWizardStep()) — sert à
      // savoir, dans closeFormToEdit(), s'il faut faire avancer le wizard à la
      // fermeture. Si un form EXISTANT est juste consulté via "View / Edit" dans
      // la liste "Use existing form" (avant même de cliquer Next), ce flag reste
      // false et la fermeture ne doit PAS avancer le wizard tout seul.
      wizardAwaitingFormClose: false,
      // Liste des SMPL_CASE_TYPE du système, affichée en bas de l'étape Case
      // du wizard pour cocher ceux liés à ce workflow (smpl_case_type_workflow_fk).
      allCaseTypes: [],
      caseTypesLoaded: false,
      // Filtre texte pour la liste de types de cas (scrollable) du wizard.
      caseTypeSearch: '',

      loading: true,
      loadingProgress: 0,
      loadingMessage: 'Loading...',
      appVersion: '2.2.9',
      resources: []
    }
  },
  computed: {
    loadedForms() {
      if (this.forms.length > 0) return this.forms.every(form => form.form)
    },
    isValidforms() {
      return this.forms.every(form => form.isValidForm)
    },
    // Liste des forms réutilisables filtrée par la recherche texte de l'utilisateur.
    filteredReusableStepForms() {
      const q = (this.newStepFormSearch || '').toLowerCase().trim()
      if (!q) return this.reusableStepForms
      return this.reusableStepForms.filter(f => f.name.toLowerCase().includes(q))
    },
    // Même chose pour la liste réutilisable du wizard de workflow.
    filteredReusableWizardForms() {
      const q = (this.newWizardFormSearch || '').toLowerCase().trim()
      if (!q) return this.reusableWizardForms
      return this.reusableWizardForms.filter(f => f.name.toLowerCase().includes(q))
    },
    // Liste des types de cas filtrée par la recherche texte, affichée dans une
    // boîte à défilement fixe dans le wizard (évite que la page grandisse
    // indéfiniment quand il y a beaucoup de types de cas).
    filteredCaseTypes() {
      const q = (this.caseTypeSearch || '').toLowerCase().trim()
      if (!q) return this.allCaseTypes
      return this.allCaseTypes.filter(ct => ct.label.toLowerCase().includes(q))
    },
    // Pastilles à afficher dans la barre du haut du wizard : une étape
    // sautable (Case/Kit) explicitement skippée (uses_X === false) disparaît
    // de la liste — sauf si c'est justement l'étape courante, pour ne pas la
    // faire disparaître sous les pieds de l'utilisateur pendant qu'il y est.
    visibleWizardSteps() {
      if (!this.workflowWizard) return this.wizardStepOrder
      return this.wizardStepOrder.filter(s => {
        const config = this.getWizardStepConfig(s)
        if (!config.skipFieldName) return true
        if (s === this.workflowWizard.step) return true
        return this.workflow[config.skipFieldName] !== false
      })
    },
    // true quand l'étape affichée est la dernière du wizard (Collection) —
    // le bouton affiche alors "Submit" au lieu de "Next".
    isLastWizardStep() {
      if (!this.workflowWizard) return false
      const order = this.wizardStepOrder
      return this.workflowWizard.step === order[order.length - 1]
    },
    // Label du type d'événement pour la step en cours de création. Plus jamais
    // alimenté (pendingEventTypeId reste null, on n'écoute plus les champs du
    // form en direct) — retombe donc toujours sur le texte générique.
    newStepEventTypeLabel() {
      const form = this.forms[0]
      const id = form && form.pendingEventTypeId
      const et = id ? this.getEventTypeById(id) : null
      return et ? et.smpl_label : 'the selected event type'
    },
    // true quand le modal ouvert est l'édition d'une étape existante (pas GoTo) —
    // c'est là qu'on affiche la gestion du form si l'étape n'en a pas encore.
    isEditingStepEntity() {
      const form = this.forms[0]
      const step = form && form.entityToUpdate
      if (!step) return false
      const etStep = this.getEntityType('SMPL_WORKFLOW_STEP')
      if (step.entitytype_id !== etStep?.id) return false
      const eventType = this.getEventTypeById(step.smpl_event_type_fk)
      if (eventType?.smpl_label === 'GoTo') return false
      return true
    },
    // Side bar : même principe de recherche, mais sans le filtre d'étude
    // (la liste y est déjà groupée par étude visuellement).
    filteredSidebarWorkflows() {
      const q = (this.sidebarSearch || '').toLowerCase().trim()
      if (!q) return this.workflows
      return this.workflows.filter(wf => (wf.smpl_label || '').toLowerCase().includes(q) || (wf.study || '').toLowerCase().includes(q))
    },
    // Liste plate (plus de groupement par étude — un côté 1 étude = 1
    // workflow dans la plupart des cas rend le groupement inutile) : favoris
    // toujours en tête, puis triée selon sidebarSortField/sidebarSortDir (voir
    // toggleSidebarSort()) — sidebarSortField null = pas de tri secondaire,
    // conserve l'ordre par défaut (celui de filteredSidebarWorkflows) grâce à
    // la stabilité garantie de Array.prototype.sort.
    sortedSidebarWorkflows() {
      const list = [...this.filteredSidebarWorkflows]
      list.sort((a, b) => {
        const aFav = this.favoriteWorkflowIds.includes(a.id) ? 0 : 1
        const bFav = this.favoriteWorkflowIds.includes(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav
        if (!this.sidebarSortField) return 0
        const cmp = this.sidebarSortField === 'date'
          ? a.id - b.id
          : (a.smpl_label || '').localeCompare(b.smpl_label || '')
        return this.sidebarSortDir === 'desc' ? -cmp : cmp
      })
      return list
    },
    // Décalage à gauche du canvas SVG pour ne jamais rendre de contenu
    // (notamment le "bonhomme" Subject, proche de l'origine de la grille)
    // sous le side bar — voir onResize() qui applique le même décalage à
    // `width` pour garder le canvas cohérent avec sa zone visible réelle.
    svgOffsetLeft() {
      // Largeurs alignées sur .dd-sidebar/.dd-sidebar-collapsed (48px/264px)
      // après le restylage du side bar, sinon le canvas déborde légèrement
      // sous/au-delà du panneau.
      return this.sidebarCollapsed ? 48 : 264
    }
  },
  methods: {
    //DISPLAY
    onResize() {
      this.height = window.innerHeight - 71
      this.width = window.innerWidth - 8 - this.svgOffsetLeft
    },
    handleZoom(e) {
      this.zoomScale = e.transform.k
      d3.selectAll(".layer").attr('transform', e.transform)
    },
    getCanvasSvg() {
      // d3.select('svg') prend le PREMIER svg du DOM, qui peut être une icône DiData.
      // On remonte depuis #nodeLayer pour cibler le bon SVG canvas.
      const nodeLayer = document.getElementById('nodeLayer');
      const svgNode = nodeLayer ? nodeLayer.closest('svg') : null;
      return svgNode ? d3.select(svgNode) : d3.select('svg');
    },

    initZoom() {
      this.getCanvasSvg().call(this.zoom)
    },

    //API ROUTES
    async getResources(resources) {
      const folders = await this.dapp.$axios.$get(`/folders`)
      const folderId = folders.find(folder => folder.name == "smpl_resources")?.id
      if (folderId) {
        const files = await this.dapp.$axios.$get(`/folders/${folderId}/files`)
        for (let i = 0; i < resources.length; i++) {
          const resource = resources[i]
          const fileId = files.find(file => file.name == resource.name).id
          if (fileId) {
            const link = await this.dapp.$axios.$get(`/files/download-link/${fileId}`)
            this.resources[resource.key] = link.link.replace("smia_chuv", "chuv").replace("http://", "https://")
          } else {
            await this.$toastNotifier.notifyError('Missing file: ' + name)
          }
        }
      } else {
        await this.$toastNotifier.notifyError('Missing folder: smpl_resources')
      }
    },
    async getRouteURLByName(name) {
      const routeMap = {
        'smpl_get_all_workflows':     'smpl/workflows',
        'smpl_load_workflow':         'smpl/load-workflow',
        'smpl_get_entity_by_barcode': 'smpl/entity-by-barcode',
        'smpl_get_samples_by_steps':  'smpl/samples-by-steps',
        'smpl_get_samples_by_kit':    'smpl/samples-by-kit',
        'smpl_get_sample_counts':     'smpl/sample-counts',
        'smpl_generate_id':           'smpl/generate-id',
      }
      const base = this.dapp.$axios.defaults.baseURL
      const currentProject = $nuxt.$store.getters['currentUser/getCurrentProject']
      return `${base}${routeMap[name]}?projectId${currentProject.id ? '=' + currentProject.id : ''}`
    },
    async getAllWorkflows(id = null) {
      this.workflows = []
      let is_wf = false
      if (id) {
        const entity = await this.dapp.$axios.$get(`/entities/${id}`)
        if (entity?.smpl_study_fk) is_wf = true
      }
      const response = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_get_all_workflows'))
      response.filter(workflow => id ? (is_wf ? workflow.id == id : workflow.smpl_study_fk == id) : true).forEach(workflow => {
        this.workflows.push(workflow)
      })
    },

    //HELPER FUNCTIONS
    async getEntitiesByValue(fieldname, value) {
      const etids = [
        this.$store.getters['entityTypes/getEntityTypeByName']("SMPL_EVENT")?.id,
      ]
      const payload = {
        "entitytype_ids": etids,
        "filter": {
          "type": "bracket",
          "operationCode": "&&",
          "conditions": [
            {
              "type": "condition",
              "operationCode": "=",
              "operand": fieldname,
              "value": value
            }
          ]
        }
      }
      const data = await this.$axios.$post('entities/query', payload)
      return data.entities
    },
    async setFormIds() {
      const forms = await this.dapp.$axios.$get('/forms')
      this.stepFormId = forms.find(form => form.name == "smpl_workflow_step_edit")?.id
      this.lineFormId = forms.find(form => form.name == "smpl_workflow_line_edit")?.id
      this.workflowFormId = forms.find(form => form.name == "smpl_workflow_edit")?.id
      this.subjectFormId = forms.find(form => form.name == "smpl_subject_template")?.id
      this.caseFormId = forms.find(form => form.name == "smpl_case_template")?.id
      this.kitFormId = forms.find(form => form.name == "smpl_kit_template")?.id
      this.sampleLineFormId = forms.find(form => form.name == "smpl_sample_creation_prompt")?.id
      this.collectionFormId = forms.find(form => form.name == "smpl_collection_template")?.id
      this.caseTypeFormId = forms.find(form => form.name == "add_new_case_type")?.id
    },
    getEntityType(name) {
      return this.entityTypes.find(et => et.name == name)
    },
    getAllEntityTypes() {
      this.entityTypes = this.$store.state.entityTypes.entityTypes
      this.entityTypes.forEach(et => {
        et["_fields"] = []
      })
      const fields = this.$store.state.fields.fields
      fields.forEach(field => {
        field._entitytypes.forEach(fet => {
          let et = this.entityTypes.find(et => et.id == fet.id)
          if (et) et["_fields"].push(field)
        })
      })
    },
    getEventTypeByName(name) {
      return this.workflow.eventTypes.find(et => et.smpl_label == name)
    },
    getEventTypeById(id) {
      return this.workflow.eventTypes.find(et => et.id == id)
    },
    getStep(stepId) {
      return this.steps.find(step => step.id == stepId)
    },
    getLine(lineId) {
      const line = this.workflow.lines.find(line => line.id == lineId)
      return line
    },
    getBatch(id) {
      return this.workflow.batches.find(batch => batch.id == id)
    },
    getChoiceId(categoryName, choiceValue) {
      const category = this.$store.state.fields.choiceCategories.find(category => category.name == categoryName)
      return category._choices.find(choice => choice.value == choiceValue).id
    },
    getChoiceValue(choiceId) {
      let value
      this.$store.state.fields.choiceCategories.forEach(category => {
        const choice = category._choices.find(choice => choice.id == choiceId)
        if (choice) value = choice.value
      })
      return value
    },
    getChoiceDescription(choiceId) {
      let description
      this.$store.state.fields.choiceCategories.forEach(category => {
        const choice = category._choices.find(choice => choice.id == choiceId)
        if (choice) description = choice.description
      })
      return description
    },
    async getSamples(ids) {
      let uri = await this.getRouteURLByName('smpl_get_samples_by_steps')
      for (let i = 0; i < ids.length; i++) {
        uri += (i == 0 ? '&steps[]=' : '&steps[]=') + ids[i]
      }
      const response = await this.dapp.$axios.$get(uri)
      return response
    },
    getFieldId(name) {
      const field = this.$store.state.fields.fields.find(field => field.name == name)
      const fieldId = field.id
      return fieldId
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
      }
      try {
        const updatedEntities = await this.$axios.$put('entities/batch', params)
      } catch (error) {
        console.log(error)
      }
    },
    async batchDelete(deleteData) {
      for (let i = 0; i < deleteData.length; i++) {
        await this.dapp.$axios.$delete(`/entities/${deleteData[i].id}`)
      }
    },

    // WORKFLOW DATA SETUP
    // WORKFLOW VISUALIZATION SETUP
    setHorizontalPositions() {
      const workflowLines = this.workflow.lines.filter(line => line?.steps.length > 0)
      let positions = []
      for (let i = 0; i < workflowLines.length; i++) {
        var line = workflowLines[i]
        if (line?.smpl_workflow_line_fk) {
          let index = positions.findLastIndex(position => position.smpl_workflow_line_fk == line.smpl_workflow_line_fk)
          if (index < 0) index = positions.findIndex(position => position.id == line.smpl_workflow_line_fk)
          positions.splice(index + 1, 0, line)
        } else {
          positions.push(line)
        }
      }
      for (let i = 0; i < positions.length; i++) {
        var line = positions[i]
        line.x = i + 1
      }
    },
    async setVerticalPositions() {
      this.workflow.batches.forEach(batch => {
        batch.xMax = 0
        batch.xMin = null
      })

      const lines = this.workflow.lines.filter(line => line?.steps.length > 0)

      // Lignes aliquots (dérivées d'un step, smpl_workflow_line_fk défini)
      // toujours placées EN DESSOUS de toutes les lignes normales — même
      // principe que smpl normal (setVerticalPositions()) : avant, une ligne
      // dérivée était positionnée à la hauteur de son step parent
      // (smpl_workflow_show_hierarchy activé) ou juste après sa ligne parente
      // (mode plat), ce qui la mélangeait visuellement avec les lignes
      // normales au lieu de la distinguer en bas.
      const topLevelLines = lines.filter(line => !line?.smpl_workflow_line_fk)
      const derivedLines = lines.filter(line => line?.smpl_workflow_line_fk)

      let maxYUsed = -1

      const positionLine = (line, startPosition) => {
        var position = startPosition

        line.steps.sort((a, b) => (a.fy ? a.fy : a.y) - (b.fy ? b.fy : b.y))
        line.steps.forEach((step, index) => {
          if (step?.smpl_workflow_step_batch_fk) {
            const batch = this.workflow.batches.find(batch => batch.id == step.smpl_workflow_step_batch_fk)
            if (!batch?.y) batch.y = 0
            batch.y = Math.max(position, batch.y)
            position = batch.y
            batch.xMin = batch.xMin ? Math.min(batch.xMin, step.x) : step.x
            batch.xMax = batch.xMax ? Math.max(batch.xMax, step.x) : step.x
          }
          if (!step.smpl_workflow_step_batch_fk) {
            while (this.workflow.batches.find(batch => batch.y == position && batch.id != step?.smpl_workflow_step_batch_fk)) {
              position++
            }
          }
          step.y = line.smpl_workflow_line_is_kit && step.smpl_order == 0 ? 0 : position
          step.x = line.x
          position++
          if (step.y > maxYUsed) maxYUsed = step.y
        })
      }

      // 1er passage : toutes les lignes normales, comme avant (position part
      // toujours de 0 pour celles-ci).
      topLevelLines.forEach(line => positionLine(line, 0))

      // 2e passage : chaque ligne aliquot démarre sous la plus basse déjà
      // utilisée jusqu'ici (y compris par les aliquots précédents du même
      // passage) — elles s'empilent proprement en bas au lieu de se mélanger.
      // Pas de "+ 1" ici : les lignes normales et les lignes aliquots sont
      // dans des colonnes (x) différentes, donc partager exactement la même
      // rangée de départ ne provoque aucune collision — ça évite juste une
      // rangée vide inutile qui poussait l'aliquot trop bas visuellement.
      derivedLines.forEach(line => positionLine(line, maxYUsed))
    },
    aggregateSteps() {
      this.steps = []
      this.workflow.batches.forEach(batch => {
        batch.active = false
      })
      this.workflow.lines.forEach(line => {
        line.steps.forEach(step => {
          step.active = false
          this.steps.push(step)
        })
      })
    },
    batchAlignment() {
      this.workflow.batches.forEach(batch => {
        const steps = this.steps.filter(step => step?.smpl_workflow_step_batch_fk == batch.id)
        var lowest = 0
        steps.forEach(step => {
          lowest = Math.max(lowest, step.y)
        })
        batch.y = lowest
        steps.forEach(step => {
          step.yBatch = batch.y
        })
      })
      this.setVerticalPositions()
    },
    removeEmptyRows() {
      var rowCount = 0
      this.steps.forEach(step => {
        rowCount = Math.max(rowCount, step.y)
      })
      var positions = Array(rowCount + 1).fill();
      this.steps.forEach(step => {
        if (!positions[step.y]) positions[step.y] = [step.id]
        else positions[step.y].push(step.id)
      })
      positions = positions.filter(d => d)
      positions.forEach((elements, index) => {
        if (elements) {
          elements.forEach(id => {
            var step = this.getStep(id)
            step.y = index
            if (step?.smpl_workflow_step_batch_fk) {
              const batch = this.workflow.batches.find(batch => batch.id == step.smpl_workflow_step_batch_fk)
              batch.y = index
            }
          })
        }
      })
    },
    setLinks() {
      const lines = this.workflow.lines.filter(line => line?.steps.length > 0)
      this.links = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        var parentStep = line.smpl_workflow_line_fk ? this.getStep(line.smpl_workflow_step_fk) : {
          id: (this.workflow?.smpl_workflow_is_collection ? -1 : null),
          x: 0,
          y: 0
        }
        if (parentStep.id) {
          const optionalOffset = 0.12
          const sampleStep = line.steps[1]
          this.links.push({
            id: (parentStep.id * 10000 + sampleStep.id) * 10,
            source: [((parentStep.x + (parentStep.smpl_workflow_step_is_optional ? optionalOffset : 0)) + 0.78 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
            target: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
            origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
            dashed: true
          })
          if (this.workflow.smpl_workflow_show_hierarchy) {
            this.links.push({
              id: parentStep.id * 1000 + sampleStep.id,
              source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
              target: [sampleStep.x * this.grid.step[0], sampleStep.y * this.grid.step[1]],
              origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
              dashed: true
            })
          } else {
            this.links.push({
              id: parentStep.id * 1000 + sampleStep.id,
              source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], (parentStep.y + 0.78) * this.grid.step[1]],
              target: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], sampleStep.y * this.grid.step[1]],
              origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
              dashed: true
            })
            this.links.push({
              id: parentStep.id * 100000 + sampleStep.id * 100,
              source: [(sampleStep.x - 0.22 * (this.grid.step[1] / this.grid.step[0])) * this.grid.step[0], sampleStep.y * this.grid.step[1]],
              target: [sampleStep.x * this.grid.step[0], sampleStep.y * this.grid.step[1]],
              origin: [parentStep.x * this.grid.step[0], parentStep.y * this.grid.step[1]],
              dashed: true
            })
          }
        }
      }
    },
    async deleteStep(step) {
      // 1. Clear any goto references pointing to this step from other steps
      const gotoRefs = []
      this.workflow.lines.forEach(l => {
        l.steps.forEach(s => {
          if (s.smpl_workflow_step_goto_fk == step.id) {
            gotoRefs.push(this.$axios.$put(`entities/${s.id}`, { smpl_workflow_step_goto_fk: null }))
          }
        })
      })
      if (gotoRefs.length > 0) await Promise.all(gotoRefs)

      // 2. Handle batch membership — leave batch, delete batch if it becomes empty
      if (step.smpl_workflow_step_batch_fk) {
        const batch = this.getBatch(step.smpl_workflow_step_batch_fk)
        await this.$axios.$put(`entities/${step.id}`, { smpl_workflow_step_batch_fk: null })
        if (batch && batch.steps && batch.steps.filter(s => s.id !== step.id).length < 1) {
          await this.$axios.$delete('entities/' + batch.id)
        }
      }

      // 3. Delete the step
      const line = this.getLine(step.smpl_workflow_line_fk)
      await this.$axios.$delete('entities/' + step.id)

      // 4. Re-index remaining steps in the line to close the gap
      if (line) {
        const remaining = line.steps
          .filter(s => s.id !== step.id)
          .sort((a, b) => a.smpl_order - b.smpl_order)
        const reorderUpdates = remaining
          .map((s, i) => s.smpl_order !== i ? this.$axios.$put(`entities/${s.id}`, { smpl_order: i }) : null)
          .filter(Boolean)
        if (reorderUpdates.length > 0) await Promise.all(reorderUpdates)
      }
    },
    async deleteLine(line) {
      line = this.getLine(line.id)
      if (line.steps.length <= 2) {
        let entitiesToUpdate = await this.getEntitiesByValue("smpl_workflow_step_fk", line.steps[0].id)
        await entitiesToUpdate.forEach(async entity => {
          await this.$axios.$put(`entities/${entity.id}`, {
            "smpl_workflow_step_fk": null
          })
        })
        entitiesToUpdate = await this.getEntitiesByValue("smpl_workflow_step_fk", line.steps[1].id)
        await entitiesToUpdate.forEach(async entity => {
          await this.$axios.$put(`entities/${entity.id}`, {
            "smpl_workflow_step_fk": null
          })
        })
        entitiesToUpdate = await this.getEntitiesByValue("smpl_workflow_line_fk", line.id)
        await entitiesToUpdate.forEach(async entity => {
          await this.$axios.$put(`entities/${entity.id}`, {
            "smpl_workflow_line_fk": null
          })
        })
        await this.$axios.$delete('entities/' + line.steps[0].id)
        await this.$axios.$delete('entities/' + line.steps[1].id)
        await this.$axios.$delete('entities/' + line.id)
      } else {
        await this.$toastNotifier.notifyError('Remove steps before removing line')
      }
    },
    selectStep(d) {
      if (this.selectedStep?.id == d.id) {
        this.selectedStep = null
      } else {
        this.selectedStep = d
      }
      this.update()
    },
    async createBatch(step) {
      this.selectStep(step)
      const batch = await this.$axios.$post('entities', {
        "entitytype_id": step.entitytype_id,
        "smpl_workflow_fk": step.smpl_workflow_fk,
        "smpl_workflow_step_is_batch": true,
        "smpl_event_type_fk": step.smpl_event_type_fk
      })
      await this.$axios.$put(`entities/${step.id}`, {
        "smpl_workflow_step_batch_fk": batch.id
      })
      await this.reloadWorkflow()
      // Ouvre tout de suite le choix "Create new form" / "Use existing form"
      // pour le VRAI form de collecte utilisé plus tard dans smpl normal
      // (smpl_workflow_step_form_id) — pas le form d'édition des champs de
      // l'étape (stepFormId). Un batch est une SMPL_WORKFLOW_STEP comme les
      // autres, donc attachNewFormToStep/attachExistingFormToStep marchent tels quels.
      this.openBatchFormPopup(this.getBatch(batch.id))
    },

    // Réutilisé par createBatch() et par le bouton "Edit form" du groupe
    // batch dans la toolbar (voir enterToolbar()). Popup dédié et minimal —
    // ne passe PAS par forms[]/loadedForms pour éviter d'afficher tout le
    // form d'édition des champs de l'étape, qui n'a rien à voir avec le form
    // de collecte réellement utilisé en production.
    openBatchFormPopup(batch) {
      this.batchFormEntity = batch
      this.newStepFormMode = null
      this.newStepFormSearch = ''
      this.reusableStepForms = []
      if (batch.smpl_event_type_fk) {
        this.loadReusableStepForms(batch.smpl_event_type_fk)
      }
    },
    closeBatchFormPopup() {
      this.batchFormEntity = null
      this.newStepFormMode = null
    },
    async joinBatch(step, batch) {
      this.selectStep(step)
      const updateData = [{
        "id": step.id,
        "smpl_workflow_step_batch_fk": batch.id
      }, {
        "id": batch.id,
      }]
      await this.batchUpdate(updateData)
      await this.reloadWorkflow()
    },
    async leaveBatch(step) {
      this.selectStep(step)
      const batch = this.getBatch(step.smpl_workflow_step_batch_fk)
      const updateData = [{
        "id": step.id,
        "smpl_workflow_step_batch_fk": null
      }]
      await this.batchUpdate(updateData)
      if (batch.steps.length < 2) {
        await this.deleteStep(batch)
      }
      await this.reloadWorkflow()
    },

    //WORKFLOW VISUALIZATION AND DATA BINDING
    enterSteps() {
      const steps = this.steps

      function wrap(text, width) {
        text.each(function() {
          var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1,
            x = text.attr("x"),
            y = text.attr("y"),
            dy = 0,
            tspan = text.text(null)
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", dy + "em");
          while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              if (lineNumber < 1) {
                tspan = text.append("tspan")
                  .attr("x", x)
                  .attr("y", y)
                  .attr("dy", ++lineNumber * lineHeight + dy + "em")
                  .text(word);
              } else {
                tspan.text(tspan.text() + "…")
                return
              }
            }
          }
        });
      }

      /// SAMPLE LINES
      const linesWithSteps = this.workflow.lines.filter(line => line.steps?.length > 0)
      d3.select("#lineLayer").selectAll(".sampleLine").data(linesWithSteps, d => d.id).exit().remove()
      const sampleLineEnter = d3.select("#lineLayer")
        .selectAll(".sampleLine").data(linesWithSteps, d => d.id).enter()
        .append("g").classed("sampleLine", true)

      const removeBranchEnter = sampleLineEnter.filter(d => (this.workflow.smpl_workflow_is_collection || d.smpl_workflow_line_fk)).append("g").attr("class", "removeStep").style("cursor", "pointer")
        .style("visibility", "hidden")
        .attr("transform", (d) => "translate(-25," + ((d.steps[0]?.y ?? 0) - 0.5) * this.grid.step[1] + ")scale(1)")
      removeBranchEnter.append("circle").attr("r", 8).attr("fill", "white").attr("stroke", "#667085").attr("stroke-width", 1.5)
      removeBranchEnter.append("line").attr("x1", -4).attr("x2", 4).attr("stroke", "#667085").attr("stroke-width", 2)
      removeBranchEnter.on("click", async (e, line) => {
        await this.deleteLine(line)
        await this.reloadWorkflow()
      })

      sampleLineEnter.append("text")
        .attr("fill", "#041E42")
        .style("font-family", "Urbanist, sans-serif")
        .style("text-anchor", "start")
        .style("font-size", "1.4em")
        .style("font-weight", 700)
        .style("cursor", "default")
        .attr('x', -10)
        .attr('y', d => ((this.getLine(d.id).steps[0]?.y ?? 0) - 0.5) * this.grid.step[1])
        .classed("clickable", true)
        .text(d => (d.smpl_workflow_line_quantity ? d.smpl_workflow_line_quantity + "× " : "") + (d.smpl_label ? d.smpl_label : ""))
        .call(wrap, this.grid.step[0] - 40)
        .on("click", async (e, d) => {
          this.forms = [{
            id: this.lineFormId,
            entityToUpdate: d,
            form: null,
            isValidForm: true
          }]
          await this.loadForms()
        })

      // Design — bouts arrondis (comme smpl normal 2.4.0), même géométrie.
      sampleLineEnter.append("line").attr("class", "bigLine")
        .attr("stroke", d => {
          const color = this.getChoiceDescription(d.smpl_workflow_line_color)
          return color ? color : "#98A2B3"
        })
        .attr("stroke-width", 8)
        .style("stroke-linecap", "round")

      // Design — fin de ligne en point plein (timeline moderne, comme smpl
      // normal 2.4.0) au lieu d'une barre perpendiculaire ; centré exactement
      // sur le même point que l'ancien x1/y1==x2/y2, donc pas de changement
      // de géométrie.
      sampleLineEnter.append("circle").attr("class", "endLine")
        .attr("r", 7)
        .style("fill", d => {
          const color = this.getChoiceDescription(d.smpl_workflow_line_color)
          return color ? color : "#98A2B3"
        })
        .style("stroke", "#FFFFFF")
        .style("stroke-width", 2)

      const sampleLineUpdate = d3.select("#lineLayer").selectAll(".sampleLine").data(linesWithSteps, d => d.id)

      sampleLineUpdate.transition().attr("transform", d => {
        return "translate(" + ((d.steps[0]?.x ?? 0) * this.grid.step[0]) + ",0)scale(1)"
      })

      sampleLineUpdate.select("text")
        .transition()
        .attr('x', -10)
        .attr('y', d => ((this.getLine(d.id).steps[0]?.y ?? 0) - 0.5) * this.grid.step[1])

      sampleLineUpdate.select(".bigLine")
        .attr("x1", 0)
        .attr("y1", d => (this.getLine(d.id).steps[0]?.y ?? 0) * this.grid.step[1])
        .attr("x2", 0)
        .attr("y2", d => {
          const steps = this.getLine(d.id).steps
          const endStep = steps[steps.length - 1]
          return ((endStep?.y ?? 0) + 0.4) * this.grid.step[1]
        })

      sampleLineUpdate.select(".endLine")
        .attr("cx", 0)
        .attr("cy", d => {
          const steps = this.getLine(d.id).steps
          const endStep = steps[steps.length - 1]
          return ((endStep?.y ?? 0) + 0.4) * this.grid.step[1]
        })

      /// STEPS
      d3.select("#nodeLayer").selectAll(".node").data(steps, d => d.id).exit().remove()
      const nodesEnter = d3.select("#nodeLayer").selectAll(".node").data(steps, d => d.id).enter()
        .append("g").attr("class", d => "n" + d.id).classed("node", true).style("opacity", 0)

      const optionalOffset = 0.12
      nodesEnter.append("path").classed("optionalPath", true)
        .attr("d", d => "M " + (-optionalOffset * this.grid.step[0]) + ", -35 L 0, -35 L 0, 75, L " + (-optionalOffset * this.grid.step[0]) + ", 75")
        .style("fill", "none")
        .attr('stroke', d => {
          const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color)
          return color ? color : "#98A2B3"
        })
        .attr('stroke-width', 5)
        .style("stroke-dasharray", "5, 5")
        .style('opacity', 0)

      const derivation = nodesEnter.append("g").classed("derivation", true)
        .style("visibility", d => {
          const et = this.getEventTypeByName(d.type)
          return et.smpl_yields_derivative ? "visible" : "hidden"
        })

      derivation.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0.78 * this.grid.step[1])
        .attr("y2", 0.78 * this.grid.step[1])
        .attr('stroke', "#98A2B3")
        .attr('stroke-width', 3)
        .style("stroke-dasharray", "0, 6")
        .style('stroke-linecap', 'round')

      const addBranchEnter = derivation.append("g").attr("class", "addBranch").style("cursor", "pointer")
        .attr("transform", d => "translate(" + (0.78 * this.grid.step[1]) + "," + (0.78 * this.grid.step[1]) + ")scale(1)")
      addBranchEnter.append("circle").attr("r", 10).attr("fill", "white").attr("stroke", "#667085").attr("stroke-width", 1.5)
      addBranchEnter.append("line").attr("x1", -5).attr("x2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addBranchEnter.append("line").attr("y1", -5).attr("y2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addBranchEnter.on("click", async (e, d) => {
        const parentLine = this.getLine(d.smpl_workflow_line_fk)
        const childrenLines = this.workflow.lines.filter(line => line.smpl_workflow_step_fk == d.id)
        // Mis en defaultEntity aussi (comme pour addStepEnter) pour que ce soit
        // vrai/coché dès l'OUVERTURE du form si le champ y est visible — le PUT
        // dans formSubmitted() reste en place en filet de sécurité si
        // defaultEntity est ignoré (champ avec default_value propre au form).
        const caseTypeAvailableOnOpen = (this.workflow.smpl_case_type_workflow_fk || []).length > 0
        console.log('[addBranchEnter][step] opening line creation form | workflow.smpl_case_type_workflow_fk=', JSON.stringify(this.workflow.smpl_case_type_workflow_fk), '| defaultEntity.Case_type_Available=', caseTypeAvailableOnOpen)
        this.forms = [{
          id: this.lineFormId,
          form: null,
          isValidForm: true,
          defaultEntity: {
            "entitytype_id": parentLine.entitytype_id,
            "smpl_workflow_step_fk": d.id ? d.id : null,
            "smpl_workflow_line_fk": parentLine.id,
            // Tableau, pas scalaire : smpl_workflow_fk est un champ PARTAGÉ entre
            // plusieurs entity types (SMPL_CASE_TYPE, SMPL_WORKFLOW_LINE,
            // SMPL_WORKFLOW_STEP, Line_Case_Type_Quantity...) — passer ce champ
            // en "multiple" pour un usage (tâche 8, case type) l'a rendu multiple
            // PARTOUT où il est attaché. Un scalaire ici fait échouer la création
            // avec "The smpl_workflow_fk must be an array."
            "smpl_workflow_fk": [this.workflow.id],
            "smpl_order": parentLine.smpl_order + childrenLines.length + 1,
            "smpl_workflow_line_is_kit": false,
            "Case_type_Available": caseTypeAvailableOnOpen
          }
        }]
        await this.loadForms()
      })

      const addStepEnter = nodesEnter.filter(d => (!["Container creation"].includes(d.type))).append("g").attr("class", "addStep").style("cursor", "pointer")
        .attr("transform", d => "translate(0," + (0.3 * this.grid.step[1] - 5) + ")scale(1)")
        .attr("visibility", d => (d.type == "Container creation") ? "hidden" : "visible")
      addStepEnter.append("circle").attr("r", 10).attr("fill", "white").attr("stroke", "#667085").attr("stroke-width", 1.5)
      addStepEnter.append("line").attr("x1", -5).attr("x2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addStepEnter.append("line").attr("y1", -5).attr("y2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addStepEnter.on("click", async (e, d) => {
        const line = this.getLine(d.smpl_workflow_line_fk)
        const currentStepOrder = Number(d.smpl_order)
        // Reset du choix "Create new form" / "Use existing form" à chaque ouverture
        // du modal — sinon un choix fait pour l'étape précédente resterait collé.
        // null = pas de choix -> pas de form créé si l'utilisateur ne touche à rien.
        this.newStepFormMode = null
        this.newStepExistingFormId = null
        this.newStepFormSearch = ''
        this.reusableStepForms = []
        // Doit être vrai/coché DÈS L'OUVERTURE du form (pas juste au submit) —
        // via defaultEntity, donc soumis au même risque que sur les lignes
        // (voir commentaire dans formSubmitted()) si "Case_type_Available" a
        // un default_value configuré sur CE form précis : log juste en dessous
        // pour vérifier ce qui est réellement envoyé en defaultEntity ici.
        const caseTypeAvailableOnOpen = (this.workflow.smpl_case_type_workflow_fk || []).length > 0
        console.log('[addStepEnter] opening step creation form | workflow.smpl_case_type_workflow_fk=', JSON.stringify(this.workflow.smpl_case_type_workflow_fk), '| defaultEntity.Case_type_Available=', caseTypeAvailableOnOpen)
        this.forms = [{
          id: this.stepFormId,
          form: null,
          isValidForm: true,
          pendingEventTypeId: null, // reste toujours null (plus de changed-value)
          defaultEntity: {
            "entitytype_id": d.entitytype_id,
            "smpl_order": currentStepOrder + 1,
            "smpl_workflow_step_is_batch": false,
            // Tableau — voir commentaire dans addBranchEnter (champ smpl_workflow_fk partagé, multiple partout).
            "smpl_workflow_fk": [this.workflow.id],
            "smpl_workflow_line_fk": d.smpl_workflow_line_fk,
            "Case_type_Available": caseTypeAvailableOnOpen
          }
        }]
        await this.loadForms()

        const stepsToUpdate = line.steps.
        filter(step => Number(step.smpl_order) > currentStepOrder).
        map(step => {
          return {
            id: step.id,
            smpl_order: Number(step.smpl_order) + 1
          }
        })
        await Promise.all(stepsToUpdate.map(async entityStep => {
          await this.$axios.$put(`entities/${entityStep.id}`, entityStep)
        }))
        await this.reloadWorkflow()
      })

      const removeStepEnter = nodesEnter.filter(d => d.smpl_order > 1).append("g").attr("class", "removeStep").style("cursor", "pointer").style("visibility", "hidden")
        .attr("transform", d => "translate(-25,0)scale(1)").attr("visibility", "hidden")
      removeStepEnter.append("circle").attr("r", 8).attr("fill", "white").attr("stroke", "#667085").attr("stroke-width", 1.5)
      removeStepEnter.append("line").attr("x1", -4).attr("x2", 4).attr("stroke", "#667085").attr("stroke-width", 2)
      removeStepEnter.on("click", async (e, d) => {
        await this.deleteStep(d)
        await this.reloadWorkflow()
      })

      // Icône fichier par étape (create/view form au clic) retirée : le statut du
      // form n'est plus visible/gérable que via le modal d'édition de l'étape
      // (voir isEditingStepEntity + la section "Form for this step" du template).

      nodesEnter.append("path").classed("inputIcon", true)
        .style("visibility", d => (d.type != "Input" ? "hidden" : "visible"))
        .attr("d", "M -14,-10 L 14,-10 L 0,10 Z")
        .attr("stroke", d => {
          const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color)
          return color ? color : "#98A2B3"
        })
        .attr('stroke-width', 4)
        .attr('fill', 'white')

      nodesEnter.append("circle").classed("icon", true)
        .style("visibility", d => (d.type == "Input" ? "hidden" : "visible"))
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 10)
        .style('stroke', 'no-stroke')
        .on("click", (e, d) => {
          this.selectStep(d)
        })

      // Design — "eyebrow" label (majuscules + espacement des lettres, comme
      // smpl normal 2.4.0) au lieu d'un texte brut.
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
        .attr('x', 18)
        .attr('y', -13)

      nodesEnter.append("text")
        .classed("nodeName", true)
        .attr("fill", "#041E42")
        .style("font-family", "'IBM Plex Sans', sans-serif")
        .style("text-anchor", "start")
        .style("font-weight", "700")
        .attr('x', 18)
        .attr('y', 6)
        .filter(d => !["Creation", "Allocation"].includes(d.type))
        .classed("clickable", true)
        .on("click", async (e, d) => {
          this.newStepFormMode = null
          this.newStepExistingFormId = null
          this.newStepFormSearch = ''
          this.reusableStepForms = []
          // L'étape existe déjà donc son type d'événement est fixé — pas besoin
          // d'attendre un changement de champ comme pour la création, on peut
          // précharger tout de suite les forms réutilisables si elle n'en a pas.
          if (!d.smpl_workflow_step_form_id && d.smpl_event_type_fk) {
            this.loadReusableStepForms(d.smpl_event_type_fk)
          }
          this.forms = [{
            id: this.stepFormId,
            entityToUpdate: d,
            form: null,
            isValidForm: true
          }]
          await this.loadForms()
        })

      nodesEnter.append("text")
        .classed("nodeId", true)
        .style("text-anchor", "end")
        .style("font-size", "0.4em")
        .style("cursor", "default")
        .attr("fill", "#98A2B3")
        .style("opacity", 0.5)
        .attr('x', -15)
        .attr('y', 21)

      nodesEnter.append("text")
        .classed("stepConfigIcon", true)
        .attr("x", 18)
        .attr("y", -27)
        .style("font-size", "11px")
        .style("cursor", "pointer")
        .style("fill", "#98A2B3")
        .style("user-select", "none")
        .text("⚙")
        .on("click", (e, d) => {
          e.stopPropagation()
          this.openStepCustomViewConfig(d)
        })

      const nodesUpdate = d3.select("#nodeLayer").selectAll(".node").data(steps, d => d.id)
        .classed("selected", (d) => this.selectedStep?.id == d.id)

      nodesUpdate.select(".optionalPath").style("opacity", d => d.smpl_workflow_step_is_optional ? 1 : 0)


      nodesUpdate.select(".icon")
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 9)
        .attr("stroke", d => {
          const color = this.getChoiceDescription(this.getLine(d.smpl_workflow_line_fk).smpl_workflow_line_color)
          return color ? color : "#98A2B3"
        })
        .attr('stroke-width', 4)

      nodesUpdate.select(".derivation")
        .select("text")
        .html(d => d.open ? "hide" : "show")

      nodesUpdate.select('.nodeType')
        .text(d => {
          if (d.smpl_label) {
            if (this.getEventTypeByName(d.type).smpl_is_alias) {
              return "alias to " + d.smpl_workflow_step_goto_fk
            } else {
              return d.type + (d.smpl_workflow_step_is_optional ? " (opt.)" : "")
            }
          } else return ""
        })

      nodesUpdate.select('.nodeName')
        .style("cursor", d => d.active ? "pointer" : "default")
        .text(d => d.smpl_label ? d.smpl_label : d.type)
        .call(wrap, this.grid.step[0] - 40)

      nodesUpdate.select('.nodeId').text(d => d.id)

      nodesUpdate.select('.stepConfigIcon')
        .style("fill", d => d.Custom_View_ID_Step ? "#0072CE" : "#98A2B3")

      nodesUpdate
        .transition()
        .attr("transform", d => "translate(" + ((d.x + (d.smpl_workflow_step_is_optional ? optionalOffset : 0)) * this.grid.step[0]) + "," + ((d.dragged ? d.fy : d.y) * this.grid.step[1]) + ")scale(1)")
        .style("opacity", 1)

      //BATCHES
      d3.select("#batchLayer").selectAll(".batch").data(this.workflow.batches, d => d.id).exit().remove()
      const batchEnter = d3.select("#batchLayer").selectAll(".batch").data(this.workflow.batches, d => d.id).enter()
        .append("g").classed("batch", true).style("opacity", 0)
        .attr("x", this.grid.step[0])
        .attr("y", d => d.y * this.grid.step[1])

      batchEnter.append('line').attr('stroke', "#F2F4F7").attr('stroke-width', 72)
        .attr("x1", d => (d.xMin - 0.4) * this.grid.step[0])
        .attr("y1", 0)
        .attr("x2", d => (d.xMax + 1) * this.grid.step[0])
        .attr("y2", 0)

      // Icône fichier par batch (create/view form au clic) retirée : le statut
      // du form n'est plus visible/gérable que via le bouton "Edit form" de la
      // toolbar (voir openBatchFormPopup + group3 dans enterToolbar()).

      batchEnter.append("text")
        .classed("nodeId", true)
        .style("text-anchor", "end")
        .style("font-size", "0.4em")
        .style("cursor", "default")
        .attr("fill", "#98A2B3")
        .style("opacity", 0.5)
        .attr("x", 0.6 * this.grid.step[0] + 38)
        .attr("y", d => d.y * this.grid.step[1] + 24)
        .text(d => d.id)

      const batchUpdate = d3.select("#batchLayer").selectAll(".batch").data(this.workflow.batches, d => d.id)
        .transition().style("opacity", 1)

      batchUpdate.select("line").transition()
        .attr("x1", d => (d.xMin - 0.4) * this.grid.step[0])
        .attr("y1", d => d.y * this.grid.step[1])
        .attr("x2", d => (d.xMax + 1) * this.grid.step[0])
        .attr("y2", d => d.y * this.grid.step[1])
    },

    enterLinks() {
      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id).exit().remove()
      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id).enter()
        .append("line").classed("link", true)
        .style("stroke-dasharray", "0, 6")
        .style('stroke-linecap', 'round')
        .attr('stroke', "#98A2B3")
        .attr('stroke-width', 3)
        .attr("x1", d => d.origin[0])
        .attr("y1", d => d.origin[1])
        .attr("x2", d => d.origin[0])
        .attr("y2", d => d.origin[1])

      d3.select("#linkLayer").selectAll(".link").data(this.links, d => d.id)
        .transition()
        .style("opacity", 1)
        .attr("x1", d => d.source[0])
        .attr("y1", d => d.source[1])
        .attr("x2", d => d.target[0])
        .attr("y2", d => d.target[1])
    },

    enterToolbar() {
      console.log('[enterToolbar] workflows=', this.workflows.length, '| workflow.id=', this.workflow?.id)
      const toolbar = d3.select("#toolbar")
      toolbar.html("")
      toolbar.append("img").classed("smpllogo", true)
        .attr("src", this.resources.SMPL_logo_2)

      // Dropdown remplacé par le side bar (liste complète, groupée par étude,
      // toujours visible/rétractable) — ce label statique rappelle juste le
      // workflow en cours et rouvre le side bar au clic si replié.
      const workflowGroup = toolbar.append("div").attr("class", "toolbarGroup")
      workflowGroup.append("div").attr("class", "toolbarCurrentWorkflow")
        .style("cursor", "pointer")
        .text(this.workflow ? `${this.workflow.study}: ${this.workflow.smpl_label}` : '')
        .on("click", () => { this.sidebarCollapsed = false })

      // Ouvre directement le panneau wizard (avec ses pastilles Subject/Case/
      // Kit/Collection, navigables librement) — reprend à l'étape non résolue
      // s'il y en a une, sinon 'subject' par défaut. N'ouvre PAS le form
      // générique d'édition du workflow par-dessus (voir editWorkflowSettingsFromWizard,
      // réservé à la pastille "Workflow settings" DEPUIS l'intérieur du wizard) :
      // le faire ici empilait un 2e form dont la fermeture retombait sur le
      // wizard tout juste rouvert, donnant l'impression que "tout recommence".
      workflowGroup.append("a").text("Workflow settings").on("click", async (e, d) => {
        const step = this.resolveWizardResumeStep(this.workflow) || 'subject'
        this.startWorkflowWizard(step)
      })

      const group2 = toolbar.append("div").attr("class", "toolbarGroup")
      group2.append("a").text(d => this.workflow.smpl_workflow_subject_form_id ? 'Subject form' : 'Subject form').on("click", async (e, d) => {
        if (this.creatingForm) {
          return
        }
        const formLabel = this.workflow.id + '_new_subject'
        if (!this.workflow.smpl_workflow_subject_form_id) {
          const newForm = await this.duplicateForm(this.subjectFormId, formLabel)
          await this.$axios.$put(`/entities/${this.workflow.id}`, {
            "smpl_workflow_subject_form_id": newForm.id
          })
          this.workflow.smpl_workflow_subject_form_id = newForm.id
        }
        this.formIdToEdit = this.workflow.smpl_workflow_subject_form_id
      })

      // Masqué seulement si explicitement désactivé (uses_cases === false) —
      // même règle "resolved" que resolveWizardResumeStep()/visibleWizardSteps :
      // undefined/null (legacy) ou true -> on affiche, comme avant le wizard.
      if (this.workflow.smpl_workflow_uses_cases !== false) {
        group2.append("a").text(d => this.workflow.smpl_workflow_case_form_id ? 'Case form' : 'Case form').on("click", async (e, d) => {
          if (this.creatingForm) {
            return
          }
          const formLabel = this.workflow.id + '_new_case'
          if (!this.workflow.smpl_workflow_case_form_id) {
            const newForm = await this.duplicateForm(this.caseFormId, formLabel)
            await this.$axios.$put(`/entities/${this.workflow.id}`, {
              "smpl_workflow_case_form_id": newForm.id
            })
            this.workflow.smpl_workflow_case_form_id = newForm.id
          }
          this.formIdToEdit = this.workflow.smpl_workflow_case_form_id
        })
      }

      group2.append("a").text('Collection form').on("click", async (e, d) => {
        if (this.creatingForm) {
          return
        }
        if (!this.workflow.smpl_workflow_collection_form_id) {
          const formLabel = this.workflow.id + '_new_collection'
          const et = this.getEventTypeByName("Collection")
          const newForm = await this.duplicateForm(et.smpl_template_form_id, formLabel)
          await this.$axios.$put(`/entities/${this.workflow.id}`, {
            "smpl_workflow_collection_form_id": newForm.id
          })
          this.workflow.smpl_workflow_collection_form_id = newForm.id
        }
        this.formIdToEdit = this.workflow.smpl_workflow_collection_form_id
      })

      if (this.workflow.smpl_workflow_uses_kits !== false) {
        group2.append("a").text(d => this.workflow.smpl_workflow_kit_form_id ? 'Kit form' : 'Kit form').on("click", async (e, d) => {
          if (this.creatingForm) {
            return
          }
          const formLabel = this.workflow.id + '_new_kit'
          if (!this.workflow.smpl_workflow_kit_form_id) {
            const newForm = await this.duplicateForm(this.kitFormId, formLabel)
            await this.$axios.$put(`/entities/${this.workflow.id}`, {
              "smpl_workflow_kit_form_id": newForm.id
            })
            this.workflow.smpl_workflow_kit_form_id = newForm.id
          }
          this.formIdToEdit = this.workflow.smpl_workflow_kit_form_id
        })
      }

      const exportGroup = toolbar.append("div").attr("class", "toolbarGroup")
      exportGroup.append("a").text("Export JSON").on("click", () => this.exportWorkflow())

      const group3 = toolbar.append("div").attr("class", "toolbarGroup")
      if (this.selectedStep) {
        const baSelector = group3.append("div").attr("class", "toolbarElement")
        baSelector.append("label").html("Edit batch")
        const batchActionSelect = baSelector.append("select").attr("id", "baSelector")
          .on("change", async (e, d) => {
            const value = batchActionSelect.property("value")
            if (value == "new") {
              await this.createBatch(this.selectedStep)
            } else if (value == "leave") {
              await this.leaveBatch(this.selectedStep)
            } else {
              await this.joinBatch(this.selectedStep, this.getBatch(value))
            }
            this.reloadWorkflow
          })

        if (this.selectedStep.smpl_workflow_step_batch_fk) {
          batchActionSelect.append("option").property("disabled", true).property("selected", true).attr("value", "").html("Select action")
          batchActionSelect.append("option").attr("value", "leave").html("Leave batch")

          // Bouton à droite du dropdown — ouvre le même choix "Create new
          // form" / "Use existing form" que createBatch(), pour le batch dont
          // fait partie l'étape sélectionnée.
          group3.append("a").text("Edit form").on("click", () => {
            const batch = this.getBatch(this.selectedStep.smpl_workflow_step_batch_fk)
            this.openBatchFormPopup(batch)
          })
        } else {
          batchActionSelect.append("option").property("diasbled", true).property("selected", true).attr("value", "").html("Select action")
          this.workflow.batches.filter(batch => batch.smpl_event_type_fk == this.selectedStep.smpl_event_type_fk).forEach(batch => {
            batchActionSelect.append("option").attr("value", batch.id).html("Join batch " + batch.id)
          })
          batchActionSelect.append("option").attr("value", "new").html("New batch")
        }
      }
    },

    async loadForms() {
      try {
        this.loading = true
        this.forms.forEach(async (form) => {
          form.form = await this.dapp.$store.dispatch('forms/fetchForm', form.id)
        })
      } catch (error) {
        this.exceptionHandler(error)
      } finally {
        this.loading = false
      }
    },

    exceptionHandler(error) {
      this.dapp.$store.dispatch('exceptionHandler', error)
    },

    async formSubmitted(form) {
      form.submitted = true
      if (this.forms.every(form => form.submitted)) {
        await this.$toastNotifier.notifySuccess('Form submited successfully')
        if (form.e) {
          const e = form.e
          const etStep = this.getEntityType("SMPL_WORKFLOW_STEP")
          const etLine = this.getEntityType("SMPL_WORKFLOW_LINE")
          const etWf   = this.getEntityType("SMPL_WORKFLOW")
          const etCaseType = this.getEntityType("SMPL_CASE_TYPE")
          if (e.entitytype_id == etStep?.id) {
            const eventType = this.getEventTypeById(e.smpl_event_type_fk)
            if (!eventType) {
              await this.$toastNotifier.notifyError(`Type d'événement introuvable (ID: ${e.smpl_event_type_fk})`)
              await this.reloadWorkflow()
              return
            }
            const typeName = eventType.smpl_label
            const stepHasForm = !!e.smpl_workflow_step_form_id

            // Case_type_Available : log + PUT de sécurité, indépendamment de ce
            // que defaultEntity a réussi (ou pas) à faire passer à l'ouverture
            // du form (voir addStepEnter) — même raison que pour les lignes :
            // EntitiesCreatorForm/FormRendering peuvent ignorer defaultEntity
            // si le champ a son propre default_value configuré sur ce form.
            console.log('[formSubmitted][step] created step entity e=', JSON.stringify(e))
            const caseTypeAvailableStep = (this.workflow.smpl_case_type_workflow_fk || []).length > 0
            console.log('[formSubmitted][step] workflow.smpl_case_type_workflow_fk=', JSON.stringify(this.workflow.smpl_case_type_workflow_fk), '| computed=', caseTypeAvailableStep, '| e.Case_type_Available as created=', e.Case_type_Available)
            try {
              const stepPutResponse = await this.$axios.$put(`/entities/${e.id}`, { "Case_type_Available": caseTypeAvailableStep })
              console.log('[formSubmitted][step] PUT response=', JSON.stringify(stepPutResponse))
              const stepCheck = await this.$axios.$get(`/entities/${e.id}`)
              console.log('[formSubmitted][step] re-fetched step.Case_type_Available=', stepCheck.Case_type_Available)
            } catch (error) {
              console.error('[formSubmitted][step] failed to set Case_type_Available:', error)
            }

            if (typeName != "GoTo" && !stepHasForm) {
              if (this.newStepFormMode === 'existing' && this.newStepExistingFormId) {
                // "Use existing form" : on associe directement le form choisi,
                // aucune duplication n'a lieu.
                try {
                  await this.$axios.$put(`/entities/${e.id}`, {
                    "smpl_workflow_step_form_id": this.newStepExistingFormId
                  })
                } catch (error) {
                  await this.$toastNotifier.notifyError(
                    `Erreur lors de l'association du formulaire: ${error.message}`
                  )
                }
              } else if (this.newStepFormMode === 'create') {
                if (!eventType.smpl_template_form_id) {
                  await this.$toastNotifier.notifyError(
                    `Configuration manquante: Aucun formulaire template pour "${typeName}". ` +
                    `Veuillez configurer un template dans la base de données.`
                  )
                  await this.reloadWorkflow()
                  return
                }
                try {
                  const newForm = await this.duplicateForm(
                    eventType.smpl_template_form_id,
                    e.id + " " + typeName
                  )
                  await this.$axios.$put(`/entities/${e.id}`, {
                    "smpl_workflow_step_form_id": newForm.id
                  })
                  // Ouvre directement le form nouvellement créé pour que
                  // l'utilisateur puisse le remplir/configurer tout de suite.
                  this.formIdToEdit = newForm.id
                } catch (error) {
                  await this.$toastNotifier.notifyError(
                    `Erreur lors de la création du formulaire: ${error.message}`
                  )
                }
              }
              // Sinon (newStepFormMode est null) : aucun choix fait, on ne crée
              // RIEN — comportement voulu, plus de form par défaut par étape.
            }
            // Reset pour ne pas laisser le choix "collé" sur la prochaine étape créée.
            this.newStepFormMode = null
            this.newStepExistingFormId = null
            await this.reloadWorkflow()
          } else if (e.entitytype_id == etLine?.id) {
            // Case_type_Available : PUT explicite sur la ligne (voir commentaire
            // dans enterSteps()/init() — defaultEntity ne remonte pas de façon
            // fiable via EntitiesCreatorForm/forms-submit), PLUS mis directement
            // dans le payload de création des 2 steps ci-dessous (POST /entities
            // brut, sans passer par un form — donc pas soumis au même problème,
            // au cas où le champ vivrait en fait sur SMPL_WORKFLOW_STEP plutôt
            // que sur SMPL_WORKFLOW_LINE).
            console.log('[formSubmitted][line] created line entity e=', JSON.stringify(e))
            const caseTypeAvailable = (this.workflow.smpl_case_type_workflow_fk || []).length > 0
            console.log('[formSubmitted][line] workflow.smpl_case_type_workflow_fk=', JSON.stringify(this.workflow.smpl_case_type_workflow_fk), '| computed Case_type_Available=', caseTypeAvailable)
            try {
              const putResponse = await this.$axios.$put(`/entities/${e.id}`, {
                "Case_type_Available": caseTypeAvailable
              })
              console.log('[formSubmitted][line] PUT response=', JSON.stringify(putResponse))
              const lineCheck = await this.$axios.$get(`/entities/${e.id}`)
              console.log('[formSubmitted][line] re-fetched line.Case_type_Available=', lineCheck.Case_type_Available, '| full re-fetched entity=', JSON.stringify(lineCheck))
            } catch (error) {
              console.error('[formSubmitted][line] failed to set Case_type_Available on new line:', error)
            }
            const creationStep = await this.$axios.$post('entities', {
              "entitytype_id": etStep?.id,
              "smpl_order": 0,
              "smpl_workflow_step_is_optional": false,
              "smpl_workflow_step_is_batch": false,
              // Tableau — voir commentaire dans addBranchEnter (champ smpl_workflow_fk partagé, multiple partout).
              "smpl_workflow_fk": [this.workflow.id],
              "smpl_workflow_line_fk": e.id,
              "smpl_event_type_fk": this.getEventTypeByName("Creation")?.id,
              "Case_type_Available": caseTypeAvailable
            })
            console.log('[formSubmitted][step] Creation step created=', JSON.stringify(creationStep), '| sent Case_type_Available=', caseTypeAvailable)
            const secondStep = await this.$axios.$post('entities', {
              "entitytype_id": etStep?.id,
              "smpl_order": 1,
              "smpl_workflow_step_is_optional": false,
              "smpl_workflow_step_is_batch": false,
              // Tableau — voir commentaire dans addBranchEnter (champ smpl_workflow_fk partagé, multiple partout).
              "smpl_workflow_fk": [this.workflow.id],
              "smpl_workflow_line_fk": e.id,
              "smpl_event_type_fk": this.getEventTypeByName(e.smpl_workflow_line_fk ? "Allocation" : "Collection")?.id,
              "Case_type_Available": caseTypeAvailable
            })
            console.log('[formSubmitted][step] second step created=', JSON.stringify(secondStep), '| sent Case_type_Available=', caseTypeAvailable)
            const creationStepCheck = await this.$axios.$get(`/entities/${creationStep.id}`)
            console.log('[formSubmitted][step] re-fetched Creation step Case_type_Available=', creationStepCheck.Case_type_Available)
            await this.reloadWorkflow()
          } else if (e.entitytype_id == etWf?.id) {
            await this.getAllWorkflows()
            // loadWorkflow() ouvre le wizard tout seul (resume-logic) : un
            // workflow qui vient d'être créé n'a par définition aucun form
            // encore configuré, donc il rouvrira à l'étape Subject.
            await this.loadWorkflow(e.id)
          } else if (e.entitytype_id == etCaseType?.id) {
            // Nouveau type de cas créé depuis le bouton "+" du wizard (étape
            // Case) : recharger la liste (caseTypesLoaded reset pour forcer le
            // refetch) et le lier tout de suite à CE workflow — c'est pour ça
            // qu'on vient de le créer depuis cet écran précis.
            this.caseTypesLoaded = false
            await this.loadAllCaseTypes()
            await this.toggleWorkflowCaseType(e.id)
          } else {
            await this.reloadWorkflow()
          }
        } else {
          await this.getAllWorkflows()
          await this.reloadWorkflow()
        }
        this.forms = []
      }
    },

    submit() {
      if (this.loadedForms) {
        this.forms.forEach(form => {
          if (!form.submitted) {
            this.$refs[`formRendering${form.id}`][0].submit();
            form.isValidForm = this.$refs[`formRendering${form.id}`][0].isValidForm
          }
        })
        return true
      }
      return false
    },

    init() {
      // Sans cette garde, chaque appel (loadWorkflow() en rappelle un à chaque
      // reload — Next du wizard, PUT de step, etc.) empilait un NOUVEAU groupe
      // #bonhomme en plus des précédents au lieu de réutiliser l'existant :
      // plusieurs bonhommes superposés, dont certains avec une image "person"
      // pointant vers un lien de téléchargement pré-signé qui a fini par
      // expirer entre-temps -> icône d'image cassée sur le node Subject.
      if (!d3.select("#nodeLayer").select("#bonhomme").empty()) return
      const bonhomme = d3.select("#nodeLayer").append("g").attr("id", "bonhomme")
      bonhomme.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0.78 * this.grid.step[1])
        .attr("y2", 0.78 * this.grid.step[1])
        .attr('stroke', "#98A2B3")
        .attr('stroke-width', 3)
        .style("stroke-dasharray", "0, 6")
        .style('stroke-linecap', 'round')

      const addBranchEnter = bonhomme.append("g").attr("class", "addBranch").style("cursor", "pointer")
        .attr("transform", d => "translate(" + (0.78 * this.grid.step[1]) + "," + (0.78 * this.grid.step[1]) + ")scale(1)")
      addBranchEnter.append("circle").attr("r", 10).attr("fill", "white").attr("stroke", "#667085").attr("stroke-width", 1.5)
      addBranchEnter.append("line").attr("x1", -5).attr("x2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addBranchEnter.append("line").attr("y1", -5).attr("y2", 5).attr("stroke", "#667085").attr("stroke-width", 2)
      addBranchEnter.on("click", async (e, d) => {
        const childrenLines = this.workflow.lines.filter(line => !line.smpl_workflow_step_fk)
        const caseTypeAvailableOnOpen = (this.workflow.smpl_case_type_workflow_fk || []).length > 0
        console.log('[addBranchEnter][bonhomme] opening line creation form | workflow.smpl_case_type_workflow_fk=', JSON.stringify(this.workflow.smpl_case_type_workflow_fk), '| defaultEntity.Case_type_Available=', caseTypeAvailableOnOpen)
        this.forms = [{
          id: this.lineFormId,
          form: null,
          isValidForm: true,
          defaultEntity: {
            "entitytype_id": this.getEntityType("SMPL_WORKFLOW_LINE").id,
            // Tableau — voir commentaire dans addBranchEnter (champ smpl_workflow_fk partagé, multiple partout).
            "smpl_workflow_fk": [this.workflow.id],
            "smpl_order": childrenLines.length + 1,
            "smpl_workflow_line_is_kit": true,
            "Case_type_Available": caseTypeAvailableOnOpen
          }
        }]
        await this.loadForms()
      })

      bonhomme.append("text")
        .attr("id", "bonhommeSubject")
        .attr("fill", "#041E42")
        .style("font-family", "Urbanist, sans-serif")
        .style("text-anchor", "start")
        .style("font-size", "1.4em")
        .style("font-weight", 700)
        .style("cursor", "default")
        .attr('x', -10)
        .attr('y', -0.45 * this.grid.step[1])
        .html("Subject")

      bonhomme.append("circle")
        .attr("cx", 0).attr("cy", 0).attr("r", 22)
        .style("fill", "white")
        .style("stroke", "#0072CE")
        .style("stroke-width", 3)

      bonhomme.append("image").attr("xlink:href", this.resources.person)
        .attr("fill", "black")
        .attr("x", -15).attr("y", -15)
        .attr("width", 30)
        .attr("height", 30)
    },

    update() {
      console.log('[update] start — workflow.lines=', this.workflow?.lines?.length, 'eventTypes=', this.workflow?.eventTypes?.length)
      this.steps = []
      this.workflow.lines.forEach(line => {
        line.steps.forEach(step => {
          this.steps.push(step)
        })
      })
      console.log('[update] steps collected:', this.steps.length)
      this.setHorizontalPositions()
      this.setVerticalPositions()
      this.aggregateSteps()
      for (var i = 0; i < 15; i++) this.batchAlignment()
      this.removeEmptyRows()
      this.setVerticalPositions()
      for (var i = 0; i < 15; i++) this.batchAlignment()
      this.removeEmptyRows()
      this.setLinks()
      this.enterSteps()
      this.enterLinks()
      this.enterToolbar()
    },

    newWorkflow() {
      const data = {
        name: "",
        batches: [],
        deltas: [],
        steps: [{
          "id": 1000,
          "parent": null,
          "type": "SMPL_SUBJECT",
          "label": "Participant"
        }],
        segments: [{
          "id": 1000,
          "parent": null,
          "steps": [1000]
        }]
      }
      this.workflow = {
        "id": 1000,
        "name": "",
        "data": data
      }
    },

    async reloadWorkflow() {
      this.workflow = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_load_workflow') + '&workflowId=' + this.workflow.id)
      this.update()
    },

    closeFormToEdit() {
      this.formIdToEdit = null
      // N'avance le wizard que si ce form venait d'être créé par "Create new
      // form" (wizardAwaitingFormClose) — pas si c'était juste un "View / Edit"
      // sur un form existant consulté depuis la liste "Use existing form".
      if (this.workflowWizard && this.wizardAwaitingFormClose) {
        this.wizardAwaitingFormClose = false
        this.advanceWizard()
      }
    },

    fieldNamesByType(typeName) {
      const prefix = 'smpl'
      const fieldNamesByType = {
        SMPL_SUBJECT: {
          formFieldName: 'smpl_workflow_subject_form_id',
          formName: prefix + ' ' + 'New Subject'
        },
        SMPL_CASE: {
          formFieldName: 'smpl_workflow_case_form_id',
          formName: prefix + ' ' + 'New Case',
        },
        SMPL_KIT: {
          formFieldName: 'smpl_workflow_kit_form_id',
          formName: prefix + ' ' + 'New Kit',
        },
        SMPL_COLLECTION: {
          formFieldName: 'smpl_workflow_collection_form_id',
          formName: prefix + ' ' + 'New Collection',
        },
        SMPL_SAMPLE_CREATION: {
          formFieldName: 'smpl_sample_creation_form_id',
          formName: prefix + ' ' + 'New Sample creation prompt',
        },
      }
      return fieldNamesByType[typeName]
    },

    async newForm(typeName, label, entity = null) {
      this.creatingForm = true
      const entityType = this.getEntityType(typeName)
      const response = await this.$axios.$post('/forms', {
        name: label,
        entitytype_id: entityType.id,
        cols: 1
      })
      const formId = response.id
      if (typeName == "SMPL_SUBJECT") {
        this.workflow.smpl_workflow_subject_form_id = formId
        await this.$axios.$put(`/entities/${this.workflow.id}`, {
          "smpl_workflow_subject_form_id": formId
        })
      } else if (typeName == "SMPL_CASE") {
        this.workflow.smpl_workflow_case_form_id = formId
        await this.$axios.$put(`/entities/${this.workflow.id}`, {
          "smpl_workflow_case_form_id": formId
        })
      } else if (typeName == "SMPL_KIT") {
        this.workflow.smpl_workflow_kit_form_id = formId
        await this.$axios.$put(`/entities/${this.workflow.id}`, {
          "smpl_workflow_kit_form_id": formId
        })
      } else if (typeName == "SMPL_COLLECTION") {
        this.workflow.smpl_workflow_collection_form_id = formId
        await this.$axios.$put(`/entities/${this.workflow.id}`, {
          "smpl_workflow_collection_form_id": formId
        })
      } else if (typeName == "SMPL_EVENT") {
        let formFieldName = this.fieldNamesByType[typeName]?.formFieldName || 'smpl_workflow_step_form_id'
        entity[formFieldName] = formId
        await this.$axios.$put(`/entities/${entity.id}`, {
          [formFieldName]: formId
        })
      }
      this.creatingForm = false
      await this.reloadWorkflow()
    },

    async loadWorkflow(wfid) {
      console.log('[loadWorkflow] called with wfid=', wfid, '| workflows.length=', this.workflows.length)
      if (this.workflows.length > 0) {
        if (!wfid) wfid = this.workflows[0].id
        try {
          this.workflow = await this.dapp.$axios.$get(await this.getRouteURLByName('smpl_load_workflow') + '&workflowId=' + wfid)
        } catch (err) {
          console.error('[loadWorkflow] smpl_load_workflow FAILED for wfid=', wfid, err)
          return
        }
        console.log('[loadWorkflow] workflow loaded:', {
          id: this.workflow?.id,
          label: this.workflow?.smpl_label,
          is_collection: this.workflow?.smpl_workflow_is_collection,
          lines: this.workflow?.lines?.length,
          batches: this.workflow?.batches?.length,
          eventTypes: this.workflow?.eventTypes?.length,
          statuses: this.workflow?.statuses?.length
        })

        // RESUME LOGIC — un workflow chargé qui n'est pas encore "prêt"
        // (pas de collection form) a forcément été abandonné en plein wizard
        // (création jamais finie, ou reprise après fermeture de l'appli) :
        // on rouvre le wizard direct à la première étape non résolue, au lieu
        // de laisser l'utilisateur atterrir sur un canvas incomplet sans le
        // savoir. Ne se déclenche qu'ici (au chargement), jamais depuis
        // reloadWorkflow() — sinon le wizard se rouvrirait tout seul après
        // chaque action normale (delete step, add line, etc.) même quand
        // l'utilisateur l'a fermé exprès pour aller éditer le canvas.
        const resumeStep = this.resolveWizardResumeStep(this.workflow)
        console.log('[loadWorkflow] resume step=', resumeStep)
        if (resumeStep) {
          this.startWorkflowWizard(resumeStep)
        }

        for (const line of this.workflow.lines) {
          for (const step of line.steps) {
            const hasFormId = step.hasOwnProperty('smpl_workflow_step_form_id') && step.smpl_workflow_step_form_id !== null && step.smpl_workflow_step_form_id !== undefined
            if (!hasFormId && step.id) {
              try {
                const stepFromDB = await this.$axios.$get(`/entities/${step.id}`)
                if (stepFromDB.smpl_workflow_step_form_id) {
                  this.$set(step, 'smpl_workflow_step_form_id', stepFromDB.smpl_workflow_step_form_id)
                }
              } catch (error) {
                console.error('Error loading step:', error)
              }
            }
          }
        }

        console.log('[loadWorkflow] calling update()')
        try {
          this.update()
        } catch (err) {
          console.error('[loadWorkflow] update() THREW:', err)
        }
        this.getCanvasSvg().transition().call(this.zoom.transform, d3.zoomIdentity.translate(this.grid.origin[0], this.grid.origin[1]).scale(this.zoomScale))

        console.log('[loadWorkflow] smpl_workflow_is_collection=', this.workflow.smpl_workflow_is_collection)
        if (this.workflow.smpl_workflow_is_collection) {
          console.log('[loadWorkflow] calling init() to draw bonhomme')
          this.init()
        } else {
          console.log('[loadWorkflow] not a collection workflow — bonhomme removed')
          d3.select("#nodeLayer").select("#bonhomme").remove()
        }
      } else {
        this.forms = [{
          id: this.workflowFormId,
          form: null,
          isValidForm: true,
          defaultEntity: {
            "entitytype_id": this.getEntityType("SMPL_WORKFLOW").id
          }
        }]
        await this.loadForms()
      }
    },

    // Ouvre le form de création directement — accessible depuis le side bar.
    async openNewWorkflowForm() {
      this.forms = [{
        id: this.workflowFormId,
        form: null,
        isValidForm: true,
        defaultEntity: {
          "entitytype_id": this.getEntityType("SMPL_WORKFLOW").id
        }
      }]
      await this.loadForms()
    },

    // Choix d'un workflow depuis le side bar — pas d'écran de chargement
    // pleine page ici (demande explicite) : le changement de workflow doit
    // rester discret, pas passer par la barre de progression du tout premier
    // chargement de l'app.
    async selectWorkflow(id) {
      if (this.workflow && this.workflow.id == id) return
      await this.loadWorkflow(id)
    },

    //==========================
    // SIDE BAR — pin / tri / favoris (localStorage, propre à smpl config)
    //==========================

    // Lu une seule fois au montage — voir mounted(). Aucune de ces 3 valeurs
    // ne dépend de données serveur, donc appelable avant tout fetch.
    loadSidebarPreferences() {
      try {
        this.sidebarPinned = localStorage.getItem('smplConfigSidebarPinned') === 'true'
        if (this.sidebarPinned) this.sidebarCollapsed = false
        const stored = localStorage.getItem('smplConfigFavoriteWorkflows')
        this.favoriteWorkflowIds = stored ? JSON.parse(stored) : []
      } catch (e) {
        console.warn('[sidebar] localStorage unavailable:', e.message)
      }
    },

    toggleSidebarPin() {
      this.sidebarPinned = !this.sidebarPinned
      try {
        localStorage.setItem('smplConfigSidebarPinned', String(this.sidebarPinned))
      } catch (e) {}
      // Épingler rouvre tout de suite ; désépingler ne referme pas tout seul
      // (l'utilisateur garde la main via le toggle habituel).
      if (this.sidebarPinned) this.sidebarCollapsed = false
    },

    toggleFavoriteWorkflow(id, event) {
      if (event) event.stopPropagation()
      const next = this.favoriteWorkflowIds.includes(id)
        ? this.favoriteWorkflowIds.filter(x => x !== id)
        : [...this.favoriteWorkflowIds, id]
      this.favoriteWorkflowIds = next
      try {
        localStorage.setItem('smplConfigFavoriteWorkflows', JSON.stringify(next))
      } catch (e) {}
    },

    // Cycle à 3 états par colonne : pas encore la colonne active -> descendant ;
    // déjà descendant sur cette colonne -> ascendant ; déjà ascendant -> plus
    // aucun tri (sidebarSortField = null, retour à l'ordre par défaut).
    toggleSidebarSort(field) {
      if (this.sidebarSortField !== field) {
        this.sidebarSortField = field
        this.sidebarSortDir = 'desc'
      } else if (this.sidebarSortDir === 'desc') {
        this.sidebarSortDir = 'asc'
      } else {
        this.sidebarSortField = null
      }
    },

    //==========================
    // CUSTOM VIEW PAR STEP
    //==========================

    openStepCustomViewConfig(step) {
      this.stepCustomViewPopup = { stepId: step.id, stepLabel: step.smpl_label || step.type }
    },

    closeStepCustomViewConfig() {
      this.stepCustomViewPopup = null
    },

    async saveStepCustomView(viewId) {
      if (!this.stepCustomViewPopup) return
      const stepId = this.stepCustomViewPopup.stepId
      const step = this.getStep(stepId)
      if (!step) return
      const id = viewId ? parseInt(viewId) : null
      try {
        await this.dapp.$axios.$put(`/entities/${stepId}`, { Custom_View_ID_Step: id })
        step.Custom_View_ID_Step = id
        this.$toastNotifier && this.$toastNotifier.notifySuccess(id ? 'Custom view saved' : 'Custom view cleared')
        this.closeStepCustomViewConfig()
        this.enterSteps()
      } catch (e) {
        this.$toastNotifier && this.$toastNotifier.notifyError('Failed to save: ' + e.message)
      }
    },

    applyCssStyle() {
      const css = '.body { height: 600px !important; }'
      const head = document.head || document.getElementsByTagName('head')[0]
      const style = document.createElement('style')
      head.appendChild(style)
      style.type = 'text/css'
      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
      d3.select("#developpedBySBP").append("img").attr("src", this.resources.LOGO_SBP)
    },

    //==========================
    // REUSE VS AUTO-DUPLICATE (form choice)
    //==========================

    // Sans "use-create-entity", EntitiesCreatorForm passe par
    // forms/{id}/submit (le seul chemin qui crée aussi les "children") et
    // entity-created renvoie alors [entiteCreee, ...children] quand des
    // children existent sur le form, ou l'entité seule sinon.
    onEntityCreated(e, form) {
      form.e = Array.isArray(e) ? e[0] : e
    },

    // Capture le type d'événement choisi EN DIRECT dans le form de création
    // de step (champ smpl_event_type_fk) — sans ça, "Use existing form" ne
    // pouvait pas filtrer par type d'événement à la création (seulement à
    // l'édition, où le step existe déjà et son type est connu à l'avance) et
    // listait tous les forms de tous les types confondus. Payload de
    // changed-value = { [nom_du_champ]: valeur } (DisplayedContentMixins.js).
    onCreatorFormFieldChanged(payload, form) {
      if (payload && Object.prototype.hasOwnProperty.call(payload, 'smpl_event_type_fk')) {
        form.pendingEventTypeId = payload.smpl_event_type_fk
        console.log('[onCreatorFormFieldChanged] smpl_event_type_fk ->', payload.smpl_event_type_fk, '| form.id=', form.id)
      }
    },

    // Label lisible d'un workflow à partir de son id, pour afficher "Used in:
    // <workflows>" dans les listes "Use existing form" (this.workflows contient
    // TOUS les workflows du système, déjà chargés au boot pour la side bar —
    // pas de fetch supplémentaire nécessaire ici).
    resolveWorkflowLabel(id) {
      const wf = this.workflows.find(w => w.id == id)
      if (!wf) return `#${id}`
      const label = wf.smpl_label || ''
      const truncatedLabel = label.length > 10 ? label.slice(0, 10) + '...' : label
      return `${wf.study}: ${truncatedLabel}`
    },

    // Cherche les SMPL_WORKFLOW_STEP existants (tout le système, pas juste ce
    // workflow — un form peut avoir du sens à réutiliser au-delà du workflow
    // courant) et regroupe par smpl_workflow_step_form_id pour obtenir la
    // liste "form -> nombre d'étapes qui l'utilisent déjà" (le "used by N").
    // eventTypeId est optionnel : côté édition (étape déjà créée) on le
    // connaît et on filtre dessus ; côté création, on ne peut plus le
    // connaître à l'avance (plus de suivi live des champs du form), donc on
    // liste tous les forms réutilisables tous types confondus et l'utilisateur
    // affine avec la recherche texte.
    async loadReusableStepForms(eventTypeId = null) {
      console.log('[loadReusableStepForms] called with eventTypeId=', eventTypeId)
      this.reusableStepForms = []
      this.loadingReusableForms = true
      try {
        const stepEt = this.getEntityType('SMPL_WORKFLOW_STEP')
        console.log('[loadReusableStepForms] SMPL_WORKFLOW_STEP entity type=', stepEt)
        const payload = eventTypeId ? {
          entitytype_ids: [stepEt?.id],
          filter: {
            type: 'bracket',
            operationCode: '&&',
            conditions: [{
              type: 'condition',
              operationCode: '=',
              operand: 'smpl_event_type_fk',
              value: eventTypeId
            }]
          }
        } : {
          entitytype_ids: [stepEt?.id]
        }
        console.log('[loadReusableStepForms] query payload=', JSON.stringify(payload))
        const data = await this.$axios.$post('entities/query', payload)
        console.log('[loadReusableStepForms] raw query response=', data)
        const stepsWithThisEventType = data.entities || []
        console.log('[loadReusableStepForms] steps matching this event type:', stepsWithThisEventType.length)
        const counts = {}
        // form_id -> Set(workflow ids) : chaque step porte directement son
        // propre smpl_workflow_fk (dénormalisé, pas besoin de remonter par la
        // ligne) — permet d'afficher "Used in: <workflows>" dans la liste au
        // lieu d'un simple nombre d'étapes.
        const workflowIdsByForm = {}
        stepsWithThisEventType.forEach(step => {
          if (step.smpl_workflow_step_form_id) {
            const formId = step.smpl_workflow_step_form_id
            counts[formId] = (counts[formId] || 0) + 1
            if (!workflowIdsByForm[formId]) workflowIdsByForm[formId] = new Set()
            if (step.smpl_workflow_fk) workflowIdsByForm[formId].add(step.smpl_workflow_fk)
          }
        })
        console.log('[loadReusableStepForms] form_id -> count:', JSON.stringify(counts))
        // Un seul appel pour la liste complète des forms au lieu d'un GET par
        // form_id trouvé (ça pouvait faire des centaines de requêtes en
        // parallèle sans filtre par type d'événement — beaucoup trop lent).
        const allForms = await this.dapp.$axios.$get('/forms')
        this.reusableStepForms = allForms
          .filter(f => counts[f.id])
          .map(f => ({
            id: f.id,
            name: f.name,
            usageCount: counts[f.id],
            workflowLabels: [...(workflowIdsByForm[f.id] || [])].map(wfId => this.resolveWorkflowLabel(wfId))
          }))
          .sort((a, b) => b.usageCount - a.usageCount)
        console.log('[loadReusableStepForms] final reusableStepForms=', JSON.stringify(this.reusableStepForms))
      } catch (err) {
        console.error('[loadReusableStepForms] FAILED:', err)
      } finally {
        this.loadingReusableForms = false
      }
    },

    // Attache immédiatement un NOUVEAU form dupliqué à une étape EXISTANTE qui
    // n'en a pas encore — reprend le comportement de l'ancienne icône fichier,
    // mais déclenché depuis le modal d'édition de l'étape.
    async attachNewFormToStep(step) {
      console.log('[attachNewFormToStep] step=', step?.id, '| smpl_event_type_fk=', step?.smpl_event_type_fk, '| creatingForm=', this.creatingForm)
      if (this.creatingForm) return
      const eventType = this.getEventTypeById(step.smpl_event_type_fk)
      const templateFormId = eventType?.smpl_template_form_id || this.collectionFormId
      console.log('[attachNewFormToStep] eventType=', eventType, '| templateFormId=', templateFormId)
      if (!templateFormId) {
        await this.$toastNotifier.notifyError(`No template form found for "${eventType?.smpl_label || step.type}". Create a form named "smpl_collection_template" first.`)
        return
      }
      this.creatingForm = true
      try {
        const form = await this.duplicateForm(templateFormId, step.id + " " + (eventType?.smpl_label || step.type))
        console.log('[attachNewFormToStep] duplicated form=', form)
        await this.$axios.$put(`/entities/${step.id}`, { "smpl_workflow_step_form_id": form.id })
        step.smpl_workflow_step_form_id = form.id
        this.formIdToEdit = form.id
        console.log('[attachNewFormToStep] attached OK, formIdToEdit=', this.formIdToEdit)
      } catch (error) {
        console.error('[attachNewFormToStep] FAILED:', error)
        await this.$toastNotifier.notifyError(`Erreur lors de la création du formulaire: ${error.message}`)
      } finally {
        this.creatingForm = false
      }
    },

    // Attache immédiatement un form EXISTANT (choisi dans le sélecteur) à une
    // étape existante — aucune duplication.
    async attachExistingFormToStep(step, formId) {
      console.log('[attachExistingFormToStep] step=', step?.id, '| formId=', formId)
      try {
        await this.$axios.$put(`/entities/${step.id}`, { "smpl_workflow_step_form_id": formId })
        step.smpl_workflow_step_form_id = formId
        console.log('[attachExistingFormToStep] attached OK')
      } catch (error) {
        console.error('[attachExistingFormToStep] FAILED:', error)
        await this.$toastNotifier.notifyError(`Erreur lors de l'association du formulaire: ${error.message}`)
      }
    },

    //==========================
    // WIZARD DE CRÉATION DE WORKFLOW (Subject -> Case -> Kit -> Collection)
    //==========================
    // Portée volontairement limitée pour ce premier passage : navigation
    // Next/Submit + persistance à chaque étape. Le resume-logic complet
    // (reprendre un workflow abandonné en plein milieu) et les règles de
    // discard (supprimer un form créé en session si l'étape est annulée
    // ensuite) ne sont PAS encore construits — actuellement, revenir en
    // arrière puis re-choisir "Create new form" peut créer un form en trop.

    // Config de chaque étape : quel champ du workflow stocke le form choisi,
    // quel form-template dupliquer pour "Create new form", et (pour Case/Kit)
    // quel champ stocke le choix "sauter cette étape".
    getWizardStepConfig(step) {
      const configs = {
        subject: {
          label: 'Subject form',
          fieldName: 'smpl_workflow_subject_form_id',
          templateFormId: this.subjectFormId,
          skipFieldName: null
        },
        case: {
          label: 'Case form',
          fieldName: 'smpl_workflow_case_form_id',
          templateFormId: this.caseFormId,
          skipFieldName: 'smpl_workflow_uses_cases'
        },
        kit: {
          label: 'Kit form',
          fieldName: 'smpl_workflow_kit_form_id',
          templateFormId: this.kitFormId,
          skipFieldName: 'smpl_workflow_uses_kits'
        },
        collection: {
          label: 'Collection form',
          fieldName: 'smpl_workflow_collection_form_id',
          templateFormId: this.getEventTypeByName('Collection')?.smpl_template_form_id,
          skipFieldName: null
        }
      }
      return configs[step]
    },

    startWorkflowWizard(step = 'subject') {
      console.log('[wizard] starting for workflow', this.workflow.id, 'at step', step)
      this.workflowWizard = { step, workflowId: this.workflow.id }
      this.initializeWizardStepState(step)
    },

    // Détermine à quelle étape reprendre pour un workflow pas encore prêt
    // (appelé uniquement quand smpl_workflow_collection_form_id est vide —
    // voir loadWorkflow()). Retourne null si tout est déjà résolu (ne devrait
    // pas arriver ici vu la garde côté appelant, mais reste correct si les
    // champs se remplissent dans un ordre inhabituel).
    //
    // Règle "legacy" du spec : smpl_workflow_uses_cases vide ne veut PAS dire
    // "pas encore répondu" pour un workflow ancien créé avant l'existence de
    // ce champ — mais un tel workflow a TOUJOURS un collection form (sinon il
    // n'aurait jamais pu tourner), donc il ne peut jamais atteindre cette
    // fonction par la garde de loadWorkflow(). Vide ici veut donc dire, sans
    // ambiguïté, "étape jamais complétée".
    resolveWizardResumeStep(workflow) {
      if (!workflow.smpl_workflow_subject_form_id) return 'subject'

      // Une étape sautable est résolue si elle a été explicitement sautée
      // (uses_X === false) OU si un form existe déjà — peu importe l'état du
      // flag : si un case form est déjà attaché, l'étape est clairement
      // réglée et ne doit pas se rouvrir juste parce que uses_cases n'a
      // jamais été mis à true explicitement (ex: form attaché via l'ancien
      // bouton toolbar, ou données migrées).
      const caseResolved = workflow.smpl_workflow_uses_cases === false || !!workflow.smpl_workflow_case_form_id
      if (!caseResolved) return 'case'

      const kitResolved = workflow.smpl_workflow_uses_kits === false || !!workflow.smpl_workflow_kit_form_id
      if (!kitResolved) return 'kit'

      if (!workflow.smpl_workflow_collection_form_id) return 'collection'

      return null
    },

    resetWizardFormChoice() {
      this.newWizardFormMode = null
      this.newWizardExistingFormId = null
      this.newWizardFormSearch = ''
      this.reusableWizardForms = []
    },

    // Pré-remplit l'affichage de l'étape avec ce qui est déjà enregistré sur
    // le workflow, au lieu de toujours repartir de zéro — sinon revenir sur
    // une étape déjà répondue (ex: Case déjà configuré, ou "uses cases"
    // décoché) donnait l'impression que tout était perdu alors que c'était
    // bien sauvegardé côté serveur. Appelé à chaque fois qu'on affiche une
    // étape (ouverture du wizard, clic sur une pastille, ou Next).
    initializeWizardStepState(step) {
      this.resetWizardFormChoice()
      const config = this.getWizardStepConfig(step)
      this.workflowWizardStepEnabled = config.skipFieldName
        ? this.workflow[config.skipFieldName] !== false
        : true
      const existingFormId = this.workflow[config.fieldName]
      if (existingFormId) {
        this.newWizardFormMode = 'existing'
        this.newWizardExistingFormId = existingFormId
        this.loadReusableWizardForms(config.fieldName)
      }
      if (step === 'case') this.loadAllCaseTypes()
    },

    // Ouvre le même form "Workflow settings" que le lien du toolbar, depuis
    // l'étape Subject du wizard (STEP 1 — Workflow basics, éditable à tout
    // moment). Le wizard se cache pendant ce temps (v-if="workflowWizard &&
    // !loadedForms" dans le template) et réapparaît automatiquement une fois
    // ce form soumis (formSubmitted() vide this.forms à la fin).
    editWorkflowSettingsFromWizard() {
      this.forms = [{
        id: this.workflowFormId,
        entityToUpdate: this.workflow,
        form: null,
        isValidForm: true
      }]
      this.loadForms()
    },

    // Navigation libre : on peut sauter directement sur n'importe quelle étape
    // depuis la barre du haut, pas seulement avancer/reculer séquentiellement.
    // Ne persiste rien — juste un changement d'affichage ; l'étape quittée
    // garde ce qui a déjà été enregistré (chaque étape sauvegarde au moment de
    // son propre "Next"/"Submit", pas à la sortie).
    goToWizardStep(step) {
      if (this.workflowWizard.step === step) return
      this.workflowWizard.step = step
      this.initializeWizardStepState(step)
    },

    // Charge tous les SMPL_CASE_TYPE du système une seule fois (guard
    // caseTypesLoaded) — affiché en bas de l'étape Case du wizard pour cocher
    // ceux utilisés par CE workflow (smpl_case_type_workflow_fk, champ FOREIGN
    // multiple : un simple tableau d'ids sur l'entité workflow).
    async loadAllCaseTypes() {
      console.log('[loadAllCaseTypes] called, caseTypesLoaded=', this.caseTypesLoaded, '| entityTypes.length=', this.entityTypes?.length)
      if (this.caseTypesLoaded) return
      try {
        const caseTypeEt = this.getEntityType('SMPL_CASE_TYPE')
        console.log('[loadAllCaseTypes] getEntityType("SMPL_CASE_TYPE") ->', caseTypeEt)
        if (!caseTypeEt) {
          console.log('[loadAllCaseTypes] entity type SMPL_CASE_TYPE not found in this.entityTypes — available names:', this.entityTypes?.map(et => et.name))
          this.allCaseTypes = []
          return
        }
        const payload = { entitytype_ids: [caseTypeEt.id] }
        console.log('[loadAllCaseTypes] query payload=', JSON.stringify(payload))
        const data = await this.$axios.$post('entities/query', payload)
        console.log('[loadAllCaseTypes] raw query response=', data)
        const rawEntities = data.entities || []
        console.log('[loadAllCaseTypes] entities returned:', rawEntities.length, JSON.stringify(rawEntities.map(e => ({ id: e.id, entitytype_id: e.entitytype_id, smpl_case_type_label: e.smpl_case_type_label, smpl_label: e.smpl_label }))))
        this.allCaseTypes = rawEntities
          .map(e => ({ id: e.id, label: e.smpl_case_type_label || e.smpl_label || `#${e.id}` }))
          .sort((a, b) => a.label.localeCompare(b.label))
        console.log('[loadAllCaseTypes] final allCaseTypes=', JSON.stringify(this.allCaseTypes))
      } catch (err) {
        console.error('[loadAllCaseTypes] FAILED:', err)
        this.allCaseTypes = []
      } finally {
        this.caseTypesLoaded = true
        console.log('[loadAllCaseTypes] done, caseTypesLoaded=true, allCaseTypes.length=', this.allCaseTypes.length)
      }
    },

    // Bouton "+" à côté de la liste des types de cas — ouvre le form dédié
    // pour créer une nouvelle entité SMPL_CASE_TYPE. La suite (rechargement de
    // la liste + liaison au workflow courant) se fait dans formSubmitted().
    openNewCaseTypeForm() {
      if (!this.caseTypeFormId) {
        this.$toastNotifier.notifyError('No "add_new_case_type" form found — create one first.')
        return
      }
      this.forms = [{
        id: this.caseTypeFormId,
        form: null,
        isValidForm: true,
        defaultEntity: {
          "entitytype_id": this.getEntityType("SMPL_CASE_TYPE").id
        }
      }]
      this.loadForms()
    },

    // Sauvegarde immédiate au clic (même principe que saveStepCustomView) —
    // pas d'attente du Next/Submit du wizard, pour ne rien perdre si
    // l'utilisateur navigue ailleurs via les pastilles avant de valider.
    //
    // Sérialisé via une file d'attente (this._caseTypeToggleQueue) : sans ça,
    // cliquer plusieurs case types rapidement lit `current` AVANT que le PUT
    // précédent ait mis à jour this.workflow localement — le dernier clic
    // écrase alors les précédents côté serveur (perte silencieuse, la case
    // qu'on vient de cocher revient "non coché" à l'écran). Confirmé par les
    // logs : toggle(1892) lisait current=[2797] alors que toggle(1891) venait
    // tout juste d'être envoyé avec next=[2797,1891].
    toggleWorkflowCaseType(id) {
      this._caseTypeToggleQueue = (this._caseTypeToggleQueue || Promise.resolve())
        .then(() => this._toggleWorkflowCaseTypeNow(id))
      return this._caseTypeToggleQueue
    },
    async _toggleWorkflowCaseTypeNow(id) {
      const current = this.workflow.smpl_case_type_workflow_fk || []
      const wasChecked = current.includes(id)
      const next = wasChecked ? current.filter(x => x !== id) : [...current, id]
      console.log('[toggleWorkflowCaseType] workflow.id=', this.workflow.id, '| toggled id=', id, '| current=', JSON.stringify(current), '| next=', JSON.stringify(next))
      try {
        const response = await this.$axios.$put(`/entities/${this.workflow.id}`, { smpl_case_type_workflow_fk: next })
        console.log('[toggleWorkflowCaseType] PUT response=', JSON.stringify(response))
        this.workflow.smpl_case_type_workflow_fk = next
        const check = await this.$axios.$get(`/entities/${this.workflow.id}`)
        console.log('[toggleWorkflowCaseType] re-fetched workflow.smpl_case_type_workflow_fk=', JSON.stringify(check.smpl_case_type_workflow_fk))
      } catch (error) {
        console.error('[toggleWorkflowCaseType] FAILED:', error)
        await this.$toastNotifier.notifyError(`Error saving case types: ${error.message}`)
        return
      }
      // Sens inverse : le case type lui-même garde la liste des workflows qui
      // l'utilisent (smpl_workflow_fk, sur SMPL_CASE_TYPE — PAS smpl_case_type_workflow_fk
      // ci-dessus, qui est sur le workflow). On coche -> on AJOUTE ce workflow à sa
      // liste existante (sans toucher aux autres workflows déjà liés) ; on décoche ->
      // on le retire. C'est ce qui permet à un même case type d'être réutilisé par
      // plusieurs workflows/études au lieu d'appartenir à un seul.
      await this._syncCaseTypeWorkflowLink(id, !wasChecked)
    },

    // adding=true : ajoute this.workflow.id à la liste smpl_workflow_fk du case
    // type (sans écraser les autres ids déjà présents). adding=false : le retire.
    // Le champ est normalisé en tableau à la lecture au cas où il serait encore
    // single-value côté serveur (pas encore migré en "multiple") — voir logs
    // [syncCaseTypeWorkflowLink] pour vérifier ce que l'API renvoie réellement.
    async _syncCaseTypeWorkflowLink(caseTypeId, adding) {
      try {
        const caseType = await this.$axios.$get(`/entities/${caseTypeId}`)
        console.log('[syncCaseTypeWorkflowLink] fetched case type', caseTypeId, '| raw smpl_workflow_fk=', JSON.stringify(caseType.smpl_workflow_fk))
        const current = Array.isArray(caseType.smpl_workflow_fk)
          ? caseType.smpl_workflow_fk
          : (caseType.smpl_workflow_fk ? [caseType.smpl_workflow_fk] : [])
        const workflowId = this.workflow.id
        const next = adding
          ? (current.includes(workflowId) ? current : [...current, workflowId])
          : current.filter(wfId => wfId !== workflowId)
        console.log('[syncCaseTypeWorkflowLink] caseTypeId=', caseTypeId, '| adding=', adding, '| current=', JSON.stringify(current), '| next=', JSON.stringify(next))
        const response = await this.$axios.$put(`/entities/${caseTypeId}`, { smpl_workflow_fk: next })
        console.log('[syncCaseTypeWorkflowLink] PUT response=', JSON.stringify(response))
        const check = await this.$axios.$get(`/entities/${caseTypeId}`)
        console.log('[syncCaseTypeWorkflowLink] re-fetched smpl_workflow_fk=', JSON.stringify(check.smpl_workflow_fk))
      } catch (error) {
        console.error('[syncCaseTypeWorkflowLink] FAILED for caseTypeId=', caseTypeId, '| response data=', JSON.stringify(error?.response?.data), error)
        // "The value must be an integer." sur smpl_workflow_fk = ce champ est
        // encore single-value côté admin des champs (SMPL_CASE_TYPE) — il faut
        // d'abord le repasser en "multiple" (tâche 8, étape 1) avant que ce
        // code puisse persister un tableau dessus. Message clair au lieu du
        // "Request failed with status code 422" générique d'axios.
        const serverMessage = error?.response?.data?.errors?.smpl_workflow_fk?.[0] || error?.response?.data?.message
        if (serverMessage && /integer/i.test(serverMessage)) {
          await this.$toastNotifier.notifyError('Case type not linked: "smpl_workflow_fk" on SMPL_CASE_TYPE is still single-value server-side — switch it to "multiple" in the field admin first.')
        } else {
          await this.$toastNotifier.notifyError(`Error linking case type to workflow: ${serverMessage || error.message}`)
        }
      }
    },

    // Valide et persiste l'étape courante, puis avance (ou termine si
    // Collection). Jamais de duplication silencieuse : un choix explicite est
    // requis dès que l'étape affiche le choix de form.
    async submitWizardStep() {
      const config = this.getWizardStepConfig(this.workflowWizard.step)
      const workflowId = this.workflowWizard.workflowId
      console.log('[wizard] submitWizardStep step=', this.workflowWizard.step, '| enabled=', this.workflowWizardStepEnabled, '| mode=', this.newWizardFormMode)

      // Étape "sautable" (Case/Kit) décochée : on enregistre juste le choix,
      // sans passer par un form du tout.
      if (config.skipFieldName && !this.workflowWizardStepEnabled) {
        try {
          await this.$axios.$put(`/entities/${workflowId}`, { [config.skipFieldName]: false })
          // Reflète tout de suite le skip sur this.workflow (sans attendre un
          // reload) pour que la pastille de cette étape disparaisse déjà de la
          // barre du haut au prochain rendu — voir visibleWizardSteps().
          this.workflow[config.skipFieldName] = false
        } catch (error) {
          await this.$toastNotifier.notifyError(`Error: ${error.message}`)
          return
        }
        this.advanceWizard()
        return
      }

      if (!this.newWizardFormMode) {
        await this.$toastNotifier.notifyError('Choose "Create new form" or "Use existing form" before continuing.')
        return
      }
      if (this.newWizardFormMode === 'existing' && !this.newWizardExistingFormId) {
        await this.$toastNotifier.notifyError('Select an existing form from the list.')
        return
      }

      try {
        const updatePayload = {}
        if (config.skipFieldName) updatePayload[config.skipFieldName] = true

        if (this.newWizardFormMode === 'existing') {
          updatePayload[config.fieldName] = this.newWizardExistingFormId
          await this.$axios.$put(`/entities/${workflowId}`, updatePayload)
          Object.assign(this.workflow, updatePayload)
        } else {
          if (!config.templateFormId) {
            await this.$toastNotifier.notifyError(`No template form configured for "${config.label}".`)
            return
          }
          const newForm = await this.duplicateForm(config.templateFormId, workflowId + '_' + this.workflowWizard.step)
          updatePayload[config.fieldName] = newForm.id
          await this.$axios.$put(`/entities/${workflowId}`, updatePayload)
          Object.assign(this.workflow, updatePayload)
          // Ouvre directement le form nouvellement créé pour que l'utilisateur
          // puisse le remplir/configurer tout de suite — le wizard reprend et
          // avance seulement quand ce form est fermé (voir closeFormToEdit()).
          this.wizardAwaitingFormClose = true
          this.formIdToEdit = newForm.id
          return
        }
      } catch (error) {
        await this.$toastNotifier.notifyError(`Error saving: ${error.message}`)
        return
      }

      this.advanceWizard()
    },

    advanceWizard() {
      const order = this.wizardStepOrder
      const currentIndex = order.indexOf(this.workflowWizard.step)
      if (currentIndex === order.length - 1) {
        // Dernière étape (Collection) soumise -> workflow prêt à tourner
        // (smpl_workflow_collection_form_id est maintenant renseigné).
        this.workflowWizard = null
        this.resetWizardFormChoice()
        this.reloadWorkflow()
        return
      }
      this.workflowWizard.step = order[currentIndex + 1]
      this.initializeWizardStepState(this.workflowWizard.step)
    },

    // Cherche tous les SMPL_WORKFLOW existants (tout le système) qui ont déjà
    // un form choisi pour ce champ, et regroupe par form id pour le "used by N"
    // — même principe que loadReusableStepForms, mais sur les workflows plutôt
    // que sur les steps d'un type d'événement donné.
    async loadReusableWizardForms(fieldName) {
      console.log('[loadReusableWizardForms] called with fieldName=', fieldName)
      this.reusableWizardForms = []
      this.loadingReusableWizardForms = true
      try {
        const wfEt = this.getEntityType('SMPL_WORKFLOW')
        const data = await this.$axios.$post('entities/query', { entitytype_ids: [wfEt?.id] })
        const allWorkflows = data.entities || []
        console.log('[loadReusableWizardForms] workflows fetched:', allWorkflows.length)
        const counts = {}
        // form_id -> Set(workflow ids) — ici chaque ligne EST déjà le workflow
        // (pas besoin de remonter par une ligne/step intermédiaire) : permet
        // d'afficher "Used in: <workflows>" au lieu d'un simple nombre.
        const workflowIdsByForm = {}
        allWorkflows.forEach(wf => {
          const formId = wf[fieldName]
          if (formId) {
            counts[formId] = (counts[formId] || 0) + 1
            if (!workflowIdsByForm[formId]) workflowIdsByForm[formId] = new Set()
            workflowIdsByForm[formId].add(wf.id)
          }
        })
        console.log('[loadReusableWizardForms] form_id -> count:', JSON.stringify(counts))
        const allForms = await this.dapp.$axios.$get('/forms')
        this.reusableWizardForms = allForms
          .filter(f => counts[f.id])
          .map(f => ({
            id: f.id,
            name: f.name,
            usageCount: counts[f.id],
            workflowLabels: [...(workflowIdsByForm[f.id] || [])].map(wfId => this.resolveWorkflowLabel(wfId))
          }))
          .sort((a, b) => b.usageCount - a.usageCount)
        console.log('[loadReusableWizardForms] final reusableWizardForms=', JSON.stringify(this.reusableWizardForms))
      } catch (err) {
        console.error('[loadReusableWizardForms] FAILED:', err)
      } finally {
        this.loadingReusableWizardForms = false
      }
    },

    async duplicateForm(formId, name = null) {
      const formToDuplicate = await this.dapp.$axios.$get(`/forms/${formId}`)
      if (name) formToDuplicate.name = name
      const newForm = await this.dapp.$axios.$post("/forms", formToDuplicate)
      for (let i = 0; i < formToDuplicate._displayable_form_contents.length; i++) {
        let displayableformcontent = Object.assign({}, formToDuplicate._displayable_form_contents[i])
        const details = displayableformcontent.details || {}
        delete displayableformcontent.details
        delete details.radio
        delete details.vertical
        for (const [key, value] of Object.entries(details)) {
          if (value === null) delete details[key]
        }
        // The API expects details' properties flattened at the root, not nested under "details".
        const payload = { ...displayableformcontent, ...details }
        await this.$axios.$post('/forms/' + newForm.id + '/displayableformcontent', payload)
      }
      return newForm
    },

    async exportWorkflow() {
      // Resolve a choice ID → { category, value, description } for portability
      const resolveChoice = (choiceId) => {
        if (!choiceId) return null
        for (const cat of (this.$store.state.fields.choiceCategories || [])) {
          const choice = cat._choices?.find(c => c.id == choiceId)
          if (choice) return { category: cat.name, value: choice.value, description: choice.description }
        }
        return null
      }

      // Resolve a status ID → label string
      const resolveStatus = (statusId) => {
        if (!statusId) return null
        return this.workflow.statuses?.find(s => s.id == statusId)?.smpl_label ?? null
      }

      const exportData = {
        version: '3',
        exported_at: new Date().toISOString(),
        workflow: {
          smpl_label: this.workflow.smpl_label ?? null,
          smpl_study_fk: this.workflow.smpl_study_fk ?? null,
          smpl_workflow_is_collection: this.workflow.smpl_workflow_is_collection ?? false,
          smpl_workflow_show_hierarchy: this.workflow.smpl_workflow_show_hierarchy ?? false,
          smpl_workflow_uses_kits: this.workflow.smpl_workflow_uses_kits ?? false
        },
        lines: [],
        batches: []
      }

      // Assign temp IDs for cross-referencing
      let tempId = 1
      const lineTempIds = {}
      const stepTempIds = {}
      const batchTempIds = {}
      this.workflow.lines.forEach(line => { lineTempIds[line.id] = tempId++ })
      this.workflow.lines.forEach(line => { line.steps.forEach(s => { stepTempIds[s.id] = tempId++ }) })
      this.workflow.batches.forEach(b => { batchTempIds[b.id] = tempId++ })

      // Lines + Steps
      for (const line of this.workflow.lines) {
        const lineExport = {
          _temp_id: lineTempIds[line.id],
          _parent_line_temp_id: line.smpl_workflow_line_fk ? (lineTempIds[line.smpl_workflow_line_fk] ?? null) : null,
          _parent_step_temp_id: line.smpl_workflow_step_fk ? (stepTempIds[line.smpl_workflow_step_fk] ?? null) : null,
          smpl_label: line.smpl_label ?? null,
          smpl_order: line.smpl_order ?? null,
          smpl_workflow_line_is_kit: line.smpl_workflow_line_is_kit ?? false,
          smpl_workflow_line_color: resolveChoice(line.smpl_workflow_line_color),
          smpl_workflow_line_quantity: line.smpl_workflow_line_quantity ?? null,
          smpl_container_type_fk: line.smpl_container_type_fk ?? null,
          smpl_container_volume: line.smpl_container_volume ?? null,
          smpl_sample_type_fk: line.smpl_sample_type_fk ?? null,
          smpl_content_volume: line.smpl_content_volume ?? null,
          smpl_volume_unit: resolveChoice(line.smpl_volume_unit),
          steps: []
        }

        for (const step of line.steps) {
          lineExport.steps.push({
            _temp_id: stepTempIds[step.id],
            _event_type_label: this.getEventTypeById(step.smpl_event_type_fk)?.smpl_label ?? null,
            _batch_temp_id: step.smpl_workflow_step_batch_fk ? (batchTempIds[step.smpl_workflow_step_batch_fk] ?? null) : null,
            _goto_step_temp_id: step.smpl_workflow_step_goto_fk ? (stepTempIds[step.smpl_workflow_step_goto_fk] ?? null) : null,
            _sample_status_label: resolveStatus(step.smpl_sample_status_fk),
            _status_change_label: resolveStatus(step.smpl_workflow_step_status_change_fk),
            smpl_order: step.smpl_order,
            smpl_label: step.smpl_label ?? null,
            smpl_workflow_step_is_optional: step.smpl_workflow_step_is_optional ?? false,
            smpl_workflow_step_then: step.smpl_workflow_step_then ?? null
          })
        }

        exportData.lines.push(lineExport)
      }

      // Batches
      for (const batch of this.workflow.batches) {
        exportData.batches.push({
          _temp_id: batchTempIds[batch.id],
          _event_type_label: this.getEventTypeById(batch.smpl_event_type_fk)?.smpl_label ?? null,
          _step_temp_ids: (batch.steps || []).map(s => stepTempIds[s.id]).filter(Boolean)
        })
      }

      const filename = `workflow_${(this.workflow.smpl_label || 'export').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.$toastNotifier.notifySuccess(`Exported: ${filename}`)
    },

    async linkedEvents() {},

    async deleteSamples() {
      const formsToKeep = [1, 2, 3, 4, 28, 32, 13, 19, 47, 52, 57, 63, 275, 246, 263, 258, 267, 249, 1022, 1026, 253, 1343, 1395]
      let forms = await this.dapp.$axios.$get('/forms')
      forms.forEach(async form => {
        if (!formsToKeep.includes(form.id)) await this.dapp.$axios.$delete(`/forms/${form.id}`)
      })
    },
  },

  watch: {
    // Le canvas doit se décaler (svgOffsetLeft) dès que le side bar
    // s'ouvre/se replie — sinon `width` reste calculé pour l'ancienne largeur
    // visible jusqu'au prochain redimensionnement de fenêtre.
    sidebarCollapsed() { this.onResize() }
  },

async mounted() {
  this.loadSidebarPreferences()

  const resources = [
    { key: "d3", name: "d3.min.js" },
    { key: "batch", name: "batch.svg" },
    { key: "person", name: "person.svg" },
    { key: "paw", name: "paw.svg" },
    { key: "branches_hide", name: "branches_hide.png" },
    { key: "branches_show", name: "branches_show.png" },
    { key: "SMPL_logo_2", name: "SMPL_logo_2.png" },
    { key: "LOGO_SBP", name: "LOGO_SBP.svg" }
  ];

  this.loading = true;
  this.loadingProgress = 0;

  this.loadingMessage = 'Loading resources...';
  await this.getResources(resources);
  const d3url = this.resources["d3"];
  const d3response = await fetch(d3url);
  const d3code = await d3response.text();
  const d3blob = new Blob([d3code], { type: 'application/javascript' });
  const d3blobUrl = URL.createObjectURL(d3blob);
  await this.registerLib({ url: d3blobUrl });
  URL.revokeObjectURL(d3blobUrl);
  this.loadingProgress = 20;

  this.$nextTick(() => {
    window.addEventListener('resize', this.onResize);
  });

  this.loadingMessage = 'Initializing...';
  this.zoom = d3.zoom().scaleExtent([0.25, 2]).on('zoom', this.handleZoom);
  this.initZoom();
  await this.setFormIds();
  this.loadingProgress = 40;

  this.loadingMessage = 'Loading workflows...';
  await this.getAllWorkflows();
  this.getAllEntityTypes();
  this.loadingProgress = 60;

  // Charge directement le workflow favori s'il y en a un (favoriteWorkflowIds
  // déjà lu depuis localStorage par loadSidebarPreferences() tout en haut de
  // mounted(), avant ce fetch) — sinon loadWorkflow(null) résout tout seul
  // vers this.workflows[0]. Plus d'écran de sélection intermédiaire, le side
  // bar reste disponible pour changer de workflow ensuite.
  this.loadingMessage = 'Building workflow...';
  const favoriteWorkflow = this.workflows.find(wf => this.favoriteWorkflowIds.includes(wf.id))
  await this.loadWorkflow(favoriteWorkflow ? favoriteWorkflow.id : null)
  this.loadingProgress = 80;

  this.loadingMessage = 'Finalizing...';
  this.applyCssStyle();
  this.onResize();
  this.loadingProgress = 100;
  this.loadingMessage = 'Ready';
  setTimeout(() => { this.loading = false; }, 300);

  // Charger les custom views du type sample pour la config par step
  try {
    const customviews = await this.dapp.$axios.$get('/customviews')
    const sampleCv = customviews.find(cv => cv.name === 'smpl') || customviews.find(cv => cv.name === 'smpl_global')
    if (sampleCv?.entitytype_id) {
      this.allSampleCustomViews = customviews.filter(cv => cv.entitytype_id === sampleCv.entitytype_id)
    } else {
      this.allSampleCustomViews = customviews
    }
  } catch (e) {
    console.warn('[smpl config] Could not load custom views:', e.message)
  }

  window.onkeydown = e => {
    if (e.key == "Alt") {
      d3.selectAll(".removeStep").style("visibility", "visible");
    }
  };

  window.onkeyup = e => {
    if (e.key == "Alt") {
      d3.selectAll(".removeStep").style("visibility", "hidden");
    }
  };
},
  beforeDestroy() {
    window.removeEventListener('resize', this.onResize);
  },
}