Ext.define('CustomApp', {
	extend : 'Rally.app.App',
	componentCls : 'app',
	launch : function() {
		this._createMilestoneWaspiDataStore();
	},

	/**
	 * Create the WASPI Data Store for Milestone
	 */
	_createMilestoneWaspiDataStore : function() {
		Ext.getBody().mask('Loading...');
		console.log("Rally.environment.getContext().getProject()._ref : ", Rally.environment.getContext().getProject()._ref);

		// Create filter based on settings selection
		var filter;

		filter = Ext.create('Rally.data.wsapi.Filter', {
			property : 'TargetProject',
			operator : '=',
			value : Rally.environment.getContext().getProject()._ref
		});

		milestoneWaspiDataStore = Ext.create('Rally.data.wsapi.Store', {
			model : 'Milestone',
			autoLoad : true,
			compact : false,
			context : {
				workspace : Rally.environment.getContext().getWorkspace()._ref,
				project : Rally.environment.getContext().getProject()._ref,
				projectScopeUp : false,
				projectScopeDown : true
			},
			filters : filter,
			fetch : [ 'ObjectID', 'FormattedID', 'Name', 'TargetDate', 'TargetProject', 'c_ActiveStartDate' ],
			limit : Infinity,
			listeners : {
				load : function(store, data, success) {
					if (data.length > 0) {
						this._createMilestoneDataStore(data);
					} else {
						Rally.ui.notify.Notifier.showError({
							message : 'No Milestone is associated with the selected Project.'
						});
					}
					Ext.getBody().unmask();
				},
				scope : this
			},
			sorters : [ {
				property : 'Name',
				direction : 'ASC'
			} ]
		});
	},

	/**
	 * Convert the WASPI Data Store for Milestone to Ext.data.Store
	 */
	_createMilestoneDataStore : function(myData) {

		var milestoneArr = [];

		Ext.each(myData, function(data, index) {
			var milestone = {};
			milestone.ObjectID = data.data.ObjectID;
			milestone.FormattedID = data.data.FormattedID;
			milestone.Name = data.data.Name;
			milestone.TargetDate = data.data.TargetDate;
			milestone.TargetProject = data.data.TargetProject;
			milestone.ActiveStartDate = data.data.c_ActiveStartDate;
			milestoneArr.push(milestone);
		});

		this.milestoneDataStore = Ext.create('Ext.data.Store', {
			fields : [ 'ObjectID', 'FormattedID', 'Name', 'TargetDate', 'TargetProject', 'ActiveStartDate' ],
			data : milestoneArr
		});
		this._createMilestonePicker();
	},

	/**
	 * Create the Ext.form.ComboBox for the Milestone
	 */
	_createMilestonePicker : function() {
		this.milestonePicker = Ext.create('Ext.form.ComboBox', {
			fieldLabel : 'Milestone ',
			store : this.milestoneDataStore,
			renderTo : Ext.getBody(),
			displayField : 'Name',
			queryMode : 'local',
			valueField : 'ObjectID',
			border : 1,
			style : {
				borderColor : '#000000',
				borderStyle : 'solid',
				borderWidth : '1px',
				height : '40px'
			},
			width : 400,
			padding : '10 5 5 10',
			margin : '10 5 5 10',
			shadow : 'frame',
			labelAlign : 'right',
			labelStyle : {
				margin : '10 5 5 10'
			},
			listeners : {
				select : function(combo, records, eOpts) {
					this.selectedMilestone = combo.getValue();
					this.selectedMilestoneObj = records;
					this._loadArtifacts();
				},
				scope : this
			}
		});
		this.add(this.milestonePicker);
	},

	/**
	 * Get the milestone data to create the doc
	 */
	_loadArtifacts : function() {
		
		Ext.getBody().mask('Generating Report...');

		var that = this;

		return Ext.create('Rally.data.wsapi.artifact.Store', {
			models : [ 'portfolioitem/feature', 'userstory' ],
			context : {
				workspace : that.getContext().getWorkspace()._Ref,
				project : null,
				limit : Infinity,
				projectScopeUp : false,
				projectScopeDown : true
			},
			filters : [ {
				property : 'Milestones.ObjectID',
				operator : '=',
				value : that.selectedMilestone
			} ]
		}).load().then({
			success : function(artifacts) {
				this.artifactsData = artifacts;
				this._getGridData();
			},
			scope : this
		});
	},

	/**
	 * Get grid data
	 */
	_getGridData : function() {

		var that = this;

		Ext.create('Rally.data.wsapi.Store', {
			model : 'User Story',
			autoLoad : true,
			compact : false,
			context : {
				workspace : Rally.environment.getContext().getWorkspace()._ref,
				project : Rally.environment.getContext().getProject()._ref,
				projectScopeUp : false,
				projectScopeDown : true
			},
			filters : that._getGridFilter(),
			fetch : [ 'FormattedID', 'Name', 'Feature', 'Project', 'c_KanbanState' ],
			limit : Infinity,
			listeners : {
				load : function(store, data, success) {
					console.log(data);
					that._drawGrid(store);
				},
				scope : this
			},
			sorters : [ {
				property : 'Feature',
				direction : 'ASC'
			} ]
		});

	},

	/**
	 * Filter for Grid
	 */
	_getGridFilter : function() {

		var filter = null;

		Ext.Array.each(this.artifactsData, function(artifactData) {
			if (artifactData.get("PortfolioItemTypeName") === "Feature") {
				if (filter === null) {
					filter = Ext.create('Rally.data.wsapi.Filter', {
						property : 'Feature.ObjectID',
						operator : '=',
						value : artifactData.getId()
					});
				} else {
					filter = filter.or(Ext.create('Rally.data.wsapi.Filter', {
						property : 'Feature.ObjectID',
						operator : '=',
						value : artifactData.getId()
					}));
				}
			} else {
				if (filter === null) {
					filter = Ext.create('Rally.data.wsapi.Filter', {
						property : 'ObjectID',
						operator : '=',
						value : artifactData.getId()
					});
				} else {
					filter = filter.or(Ext.create('Rally.data.wsapi.Filter', {
						property : 'ObjectID',
						operator : '=',
						value : artifactData.getId()
					}));
				}
			}

		});

		return filter;
	},

	/**
	 * Draw grid
	 */
	_drawGrid : function(gridStore) {
		var that = this;
		
		if (that.down('rallygrid')) {
			that.down('rallygrid').destroy();
		}

		this.add({
			xtype : 'rallygrid',
			columnCfgs : [  {
				text : 'Formated ID',
				dataIndex : 'FormattedID'
			}, {
				text : 'Name',
				dataIndex : 'Name'
			}, {
				text : 'Parent Feature',
				dataIndex : 'Feature'
			}, {
				text : 'Project',
				dataIndex : 'Project'
			}, {
				text : 'State',
				dataIndex : 'c_KanbanState'
			} ],
			store : gridStore,
			enableEditing : false
		});
		
		Ext.getBody().unmask();
	}
	
});
