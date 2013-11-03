"use strict";
if ("undefined" == typeof (Zotero)) {
	if (!("@zotero.org/Zotero;1" in Components.classes)) {
		if (typeof ns_zotero_autoexport == "undefined") {
			var ns_zotero_autoexport = {
				emergency : function() {
					this.currentTime = new Date();

					this.EmergencyPrefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
					this.EmergencyPrefManager.setCharPref("extensions.zoteroautoexporting.filestatus", '{"' + ((this.currentTime.getDate() < 10 ? "0" : "") + this.currentTime.getDate()) + '.' + (this.currentTime.getMonth() + 1) + '.' + this.currentTime.getFullYear() + '  ' + ((this.currentTime.getHours() < 10 ? "0" : "") + this.currentTime.getHours()) + ':' + ((this.currentTime.getMinutes() < 10 ? "0" : "") + this.currentTime.getMinutes()) + ':' + this.currentTime.getSeconds() + ':' + this.currentTime.getMilliseconds() + '":"No Zotero Addon was found. Please download from zotero.org"}');
				}
			};
			ns_zotero_autoexport.emergency();
		}
	} else {
		var Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
	}
}
if ("undefined" != typeof (Zotero) && "undefined" == typeof (Zotero.AutoExporting)) {
	Zotero.AutoExporting = {
	boolLog : false,
	boolLogAlltoPanel : false,
	boolActivated : true,
	addon_mode : 1,
	prefManager : null,
	active : null,
	fileintInterval : 1,
	filepath : null,
	filetranslator : null,
	observerPref : null,
	observerChangesZotero : null,
	fileTriggerEvent : false,
	fileTriggerTimer : true,
	fileTimer : null,
	eventTimer : null,
	file_mode_collections_map : 'general-once-settings',
	filelast : null,
	filenslfile : null,
	file_keep : false,
	file_collections_map : false,
	file_subcollections_map : false,

	Prefs : {},
	init : function() {
		this.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		// check for migrating to the new log format of version 1.0

		// for update purposes we look whether it might a json
		if (this.prefManager.getCharPref("extensions.zoteroautoexporting.filestatus").indexOf('{') > -1) {
			// we have to truncate if the array is long
			this.log_truncate();
		} else {
			this.prefManager.clearUserPref("extensions.zoteroautoexporting.filestatus");
		}

		// from here is now regular
		// init the pref observer to get a notice when prefs changed and
		// timer can be reseted
		this.log('Setup PrefObserver');
		this.observerPref = {
		register : function() {

			var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
			this._branch = prefService.getBranch("extensions.zoteroautoexporting.");
			this._branch.QueryInterface(Components.interfaces.nsIPrefBranch);
			this._branch.addObserver("", this, false);
		},
		unregister : function() {

			if (!this._branch)
				return;
			this._branch.removeObserver("", this);
		},
		observe : function(aSubject, aTopic, aData) {
			if (aTopic == "nsPref:changed" && aData != 'file-last' && aData != 'filestatus') {
				Zotero.AutoExporting.log('sub' + aSubject);
				Zotero.AutoExporting.log('data changed for ' + aData);
				Zotero.AutoExporting.reload();
			}
		}
		}
		this.observerPref.register();

		this.renew_timer('init addon');
		this.renew_events('init addon');

	},
	reload : function() {
		this.log('Reload trigger and events');

		this.renew_timer('reload after timer reset');
		this.renew_events('reload');
	},
	renew_events : function(reason)
	// function etablishs the trigger to zotero items so that we can react
	// if something is changed
	{
		this.log('renew events because of:  ' + reason);
		this.disable_events();

		if (typeof (this.addon_mode) == 'undefined' || this.addon_mode == 1) {
			this.log('abort init process for trigggering events ');
			return false;
		}

		this.fileTriggerEvent = this.prefManager.getBoolPref("extensions.zoteroautoexporting.file-event-trigger");
		if (this.fileTriggerEvent != true) {
			this.log('triggering export by events is disabled - no renew.');

			return false;
		}
		this.enable_events();

	},
	disable_events : function()
	// just disable the observer to zotero
	{
		if (this.observerChangesZotero != null) {
			Zotero.Notifier.unregisterObserver(this.observerChangesZotero);
			// and reset the notifierid backto null
			this.observerChangesZotero = null;
			// and stop the export timer for event
			if (this.eventTimer instanceof Components.interfaces.nsITimer) {
				this.eventTimer.cancel();
				this.log('Timer for event is being canceled');
			}

		}
	},
	enable_events : function()
	// just eable the observer to zotero
	{
		// Register the callback in Zotero as an item observer if not an ID
		// is already set!
		if (this.observerChangesZotero == null) {
			this.observerChangesZotero = Zotero.Notifier.registerObserver(this.notify_events, [ 'item' ]);

			// Unregister callback when the window closes (important to
			// avoid a memory leak)
			window.addEventListener('unload', function(e) {
				Zotero.Notifier.unregisterObserver(this.observerChangesZotero);
			}, false);
		} else
			this.log('Notifier for changes in Zotero is already etablished');
	},
	notify_events : {
		notify : function(event, type, ids, extradata) {
			if ("undefined" == typeof (Zotero)) {
				var Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
			}
			if ("undefined" == typeof (Zotero)) {
			} else {
				// we are triggered
				Zotero.AutoExporting.log('Triggered by event');
				// check whether the timer is already running - if not just
				// make a new one
				if ("undefined" == typeof (Zotero.AutoExporting.eventTimer) || Zotero.AutoExporting.eventTimer == null || false == Zotero.AutoExporting.eventTimer instanceof Components.interfaces.nsITimer) {
					Zotero.AutoExporting.eventTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
				}
				// now configure to export in 3 seconds
				Zotero.AutoExporting.eventTimer.initWithCallback(function() {
					Zotero.AutoExporting.autoexport();
				}, 5 * 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
				Zotero.AutoExporting.log('Set the timer for next export in 5 seconds');

			}
		}
	},
	renew_timer : function(reason) {
		this.log('Renew because of:  ' + reason);

		if (this.fileTimer instanceof Components.interfaces.nsITimer) {
			this.fileTimer.cancel();
			this.log('Timer is being canceled');
		}

		this.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

		// check whether we show debugs or not
		this.boolLog = this.prefManager.getBoolPref("extensions.zoteroautoexporting.showdebug");

		// Thats the old pref til 1.1.2
		/*
		 * this.boolActivated =
		 * !this.prefManager.getBoolPref("extensions.zoteroautoexporting.filedeactivate");
		 * if (this.boolActivated == false) { this.log('Autoexporting for files
		 * is disabled by user in the options panel for all files'); }
		 */
		// new from 1.1.2:
		this.addon_mode = this.prefManager.getIntPref("extensions.zoteroautoexporting.addon-mode");
		if (typeof (this.addon_mode) == 'undefined' || this.addon_mode == 1) {
			this.log('Autoexporting for files is disabled by user for triggering automatically');
		}
		// thats the old option!
		var temp = this.prefManager.getCharPref("extensions.zoteroautoexporting.filepath");
		if (this.prefManager.getPrefType('extensions.zoteroautoexporting.filepath') && this.prefManager.prefHasUserValue('extensions.zoteroautoexporting.filepath') && temp.length > 4) {
			this.log('Old Filepath seems good');
			this.filepath = temp;
		} else {
			this.log('Migration: Found no valid old path..');
		}
		// now check the new one :)
		if (this.prefManager.getPrefType('extensions.zoteroautoexporting.filenslfile') && this.prefManager.prefHasUserValue('extensions.zoteroautoexporting.filenslfile'))
			this.filenslfile = this.prefManager.getComplexValue("extensions.zoteroautoexporting.filenslfile", Components.interfaces.nsILocalFile);
		else
			this.filenslfile = null;
		if (typeof (this.filenslfile) != 'undefined' && this.filenslfile != null && this.filenslfile.path.length > 0) {
			this.log('Path of the new file options looks valid: ' + this.filenslfile.path);
		} else if (this.filepath != null && this.filepath.length > 0) {
			// try to migrate from the old path!
			this.filenslfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			this.filenslfile.initWithPath(this.filepath);
			this.prefManager.setComplexValue("extensions.zoteroautoexporting.filenslfile", Components.interfaces.nsILocalFile, this.filenslfile);
			this.log('Migrated from old path to the new file object');
		} else {
			// this.boolActivated = false;
			this.addon_mode = 1;
			this.log('Looks not like a valid path or file!');
		}

		var temp = this.prefManager.getCharPref("extensions.zoteroautoexporting.filetranslator");
		if (temp.length > 4) {
			this.log('Filetranslator seems good');
			this.filetranslator = temp;
		} else {
			// this.boolActivated = false;
			this.addon_mode = 1;
			this.log('Looks not like a valid filetranslator.. Sorry');
		}

		var temp = this.prefManager.getIntPref("extensions.zoteroautoexporting.fileinterval");
		if (temp < 1) {
			// this.boolActivated = false;
			this.addon_mode = 1;
			this.log('Looks not like a valid interval.. ');

		} else {
			this.fileintInterval = temp;
		}

		this.filelast = this.prefManager.getIntPref("extensions.zoteroautoexporting.file-last");
		this.file_keep = this.prefManager.getBoolPref("extensions.zoteroautoexporting.file-bool-keep-interval");

		this.file_mode_collections_map = this.prefManager.getCharPref("extensions.zoteroautoexporting.file-mode-collection-map");
		this.file_collections_map = this.prefManager.getBoolPref("extensions.zoteroautoexporting.file-bool-collections-map");
		this.file_subcollections_map = this.prefManager.getBoolPref("extensions.zoteroautoexporting.file-bool-subcollections-map");
		// import the custom collections

		this.custom_collections = this.prefManager.getCharPref("extensions.zoteroautoexporting.collection-profiles");
		if (this.custom_collections) {
			try {
				this.custom_collections = JSON.parse(this.custom_collections);
			} catch (e) {
			}
		}
		if (typeof (this.custom_collections) == 'undefined')
			this.custom_collections = {};

		this.fileTriggerTimer = this.prefManager.getBoolPref("extensions.zoteroautoexporting.file-event-timer");

		if (this.fileTriggerTimer == false) {
			this.log('Exporting by timer is disabled');
		}

		if (this.boolActivated == false || this.addon_mode == 1) {
			this.log('Abort init process and set no timer');
			return false;
		} else if (this.file_keep == true && ((Math.round(new Date().getTime() / 1000) - (this.filelast)) > this.fileintInterval * 60)) {
			this.log('Fired export because last time is longer ago as interval is set:: ' + this.fileintInterval + '--' + (Math.round(new Date().getTime() / 1000) - (this.filelast * 60)) + '.' + this.filelast * 60 + '++' + Math.round(new Date().getTime() / 1000));
			this.autoexport();
		} else {
			this.fileexportTimer();
		}
		this.log('Renew  done: ' + reason);
	},
	fileexportTimer : function() {
		if (this.fileTriggerTimer == false) {
			this.log('Exporting by timer is disabled');
			return;
		}
		if (this.fileintInterval > 2) {
			this.fileTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			this.fileTimer.initWithCallback(function() {
				Zotero.AutoExporting.autoexport();
			}, this.fileintInterval * 60 * 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			this.log('Set the timer for next export in ' + this.fileintInterval + ' minutes');
		} else {
			this.log('Interval is not correct or too less!');
		}
	},
	item_rewrite_key : function(obj, item) {

		this.log('Item Done Handler has started' + item.id);
	},
	exportCollection : function(expTranslator, collectionId) {
		var collections = Zotero.getCollections(collectionId);
		var bool_file_success = false;
		for ( var c in collections) {

			if (this.file_mode_collections_map == 'custom-collection-settings' && (typeof (this.custom_collections['Collection']['Collection_' + collections[c].id]) == 'undefined' || this.custom_collections['Collection']['Collection_' + collections[c].id]['bool-export'] == 'false')) {
				// check whether we want to export
				this.log('Skipped collection #' + collections[c].id + ' ' + collections[c].name + ' because not selected');

			} else {
				expTranslator.setCollection(collections[c]);
				var tempFile = this.filenslfile.clone();

				// setup the new filenames from collection name
				tempFile.leafName = collections[c].name.replace(new RegExp('[,/\:*?""<>|]', 'g'), "_") + ((/[.]/.exec(this.filenslfile.leafName)) ? '.' + /[^.]+$/.exec(this.filenslfile.leafName) : '');

				try {
					expTranslator.setLocation(tempFile);

					// now translate
					expTranslator.translate();
				} catch (err) {
					this.log('The Zotero Translator (#collection) does not work properly: ' + err.message);
				}
				// check whether the file is written
				if (tempFile.exists()) {
					bool_file_success = true;
					this.log('Exported collection #' + '' + collections[c].id + ' called ' + collections[c].name + ' to file as ' + tempFile.leafName);
				} else
					this.log('Not Exported collection #' + '' + collections[c].id + ' called ' + collections[c].name + ' to file as ' + tempFile.leafName);
			}
			// check for sub_collections OR Custom
			if ((this.file_subcollections_map || this.file_mode_collections_map == 'custom-collection-settings') && collections[c].hasChildCollections) {
				this.exportCollection(expTranslator, collections[c].id);
			}
		}
		return bool_file_success;
	},
	exportSearch : function(expTranslator, collectionId) {
		// var collections = Zotero.getCollections(collectionId);
		var bool_file_success = false;
		this.log('Export Groups..');
		var itemType = 'Group';

		// this is the general preperation of the search in the groups
		var groups = Zotero.Groups.getAll();
		var s = new Zotero.Search();

		s.addCondition('recursive', 'true'); // equivalent of "Search
		// subfolders" checked
		s.addCondition('noChildren', 'true'); // "Only show top level
		// children
		s.addCondition('includeParentsAndChildren', 'true');
		"Include parent and child ..."
		for ( var grou in groups) {

			if (this.file_mode_collections_map == 'custom-collection-settings' && (typeof (this.custom_collections[itemType][itemType + '_' + groups[grou].id]) == 'undefined' || this.custom_collections[itemType][itemType + '_' + groups[grou].id]['bool-export'] == 'false')) {
				// check whether we want to export
				this.log('Skipped ' + itemType + ' #' + groups[grou].id + ' ' + groups[grou].name + ' because not selected');

			} else {

				this.log(itemType + ' ' + groups[grou].name + ' will be searched');
				s.addCondition('libraryID', 'is', groups[grou].libraryID);

				var results = s.search();
				var items = Zotero.Items.get(results);

				expTranslator.setItems(items);
				var tempFile = this.filenslfile.clone();

				// setup the new filenames from collection name
				tempFile.leafName = groups[grou].name.replace(new RegExp('[,/\:*?""<>|]', 'g'), "_") + ((/[.]/.exec(this.filenslfile.leafName)) ? '.' + /[^.]+$/.exec(this.filenslfile.leafName) : '');

				try {
					expTranslator.setLocation(tempFile);

					// now translate
					expTranslator.translate();
				} catch (err) {
					this.log('The Zotero Translator (#' + itemType + ') does not work properly: ' + err.message);
				}
				// check whether the file is written
				if (tempFile.exists()) {
					bool_file_success = true;
					this.log('Exported ' + itemType + ' #' + '' + groups[grou].id + ' called ' + groups[grou].name + ' to file as ' + tempFile.leafName);
				} else
					this.log('Not Exported ' + itemType + ' #' + '' + groups[grou].id + ' called ' + groups[grou].name + ' to file as ' + tempFile.leafName);
			}
		}
		if (this.file_mode_collections_map == 'custom-collection-settings') {
			this.log('Export Searches..');
			var itemType = 'Search';
			// iterate through the groups
			for ( var grou in this.custom_collections['Search']) {
				var s = Zotero.Searches.get(this.custom_collections['Search'][grou].id);

				var results = s.search();
				var items = Zotero.Items.get(results);

				expTranslator.setItems(items);
				var tempFile = this.filenslfile.clone();

				// setup the new filenames from collection name
				tempFile.leafName = s.name.replace(new RegExp('[,/\:*?""<>|]', 'g'), "_") + ((/[.]/.exec(this.filenslfile.leafName)) ? '.' + /[^.]+$/.exec(this.filenslfile.leafName) : '');

				try {
					expTranslator.setLocation(tempFile);

					// now translate
					expTranslator.translate();
				} catch (err) {
					this.log('The Zotero Translator (#' + itemType + ') does not work properly: ' + err.message);
				}
				// check whether the file is written
				if (tempFile.exists()) {
					bool_file_success = true;
					this.log('Exported ' + itemType + ' #' + '' + s.id + ' called ' + s.name + ' to file as ' + tempFile.leafName);
				} else
					this.log('Not Exported ' + itemType + ' #' + '' + s.id + ' called ' + s.name + ' to file as ' + tempFile.leafName);
			}

		}
		return bool_file_success;
	},
	autoexport : function() {
		this.log('Run autoexporting to file');

		// var file =
		// Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		// file.initWithPath(this.filepath);

		// var this.filenslfile
		// =this.prefManager.getComplexValue("extensions.zoteroautoexporting.filenslfile",
		// Components.interfaces.nsILocalFile);
		
		if (this.filenslfile.path.length > 0) {
			var int_file_success=0;
			if ("undefined" !== typeof (ns_zotero_autoexport_toolbar))
				ns_zotero_autoexport_toolbar.icon_running();
			// ???
			this.log('Fileobject is writeable');

			this.log('Translator for export inits');
			try {
				var expTranslator = new Zotero.Translate('export');
				// expTranslator.setHandler("translators", function (obj,
				// item) { Zotero.AutoExporting.item_rewrite_key(obj,item);
				// });

				// TODO: Check better whether valid and catch!!!
				try {
					var arr_options = JSON.parse(this.prefManager.getCharPref("extensions.zoteroautoexporting.file-advancedoptions"));
					if (typeof expTranslator._displayOptions == 'undefined')
						expTranslator._displayOptions = [];
					for ( var str_key in arr_options)
						expTranslator._displayOptions[str_key] = arr_options[str_key];
				} catch (err) {
					this.log('Error parsing the advanced options: ' + this.prefManager.getCharPref("extensions.zoteroautoexporting.file-advancedoptions"));
				}
				expTranslator.setLocation(this.filenslfile);
				expTranslator.setTranslator(this.filetranslator);
				// now we will run if we need the whole library..
				if (this.file_mode_collections_map == 'general-once-settings') {
					this.log('Translator for export now run..');

					expTranslator.translate();
				} else
					this.log('Initiated the translator. Skipped whole library..');
				if (this.filenslfile.exists()) {
					int_file_success++;
				}
			} catch (err) {
				this.log('The Zotero Translator (#main) does not work properly: ' + err.message);
			}

			// export the collections too
			if (this.file_mode_collections_map != 'general-once-settings') {
				this.log('Export the collections');
				this.exportCollection(expTranslator, null);

				this.exportSearch(expTranslator, null, 'Group');
				int_file_success++;
				

				var strTextAdd = '(+collections) ';
			} else
				var strTextAdd = '';

			// check whether the file was written..
			if (int_file_success>0) {
				// POSTPROCESS now
				if (this.prefManager.getBoolPref('extensions.zoteroautoexporting.postprocessbool', false) == false) {
					if (this.prefManager.prefHasUserValue('extensions.zoteroautoexporting.postprocessfile')) {
						var cmdFile = this.prefManager.getComplexValue("extensions.zoteroautoexporting.postprocessfile", Components.interfaces.nsILocalFile);
						if (cmdFile.exists()) {
							this.log('Postprocessfile will executed now..');
							var cmdProcess = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
							cmdProcess.init(cmdFile);

							var args = [ "ar", "test" ];
							cmdProcess.run(false, args, args.length);
							strTextAdd += ' and runned postprocess';
						} else {
							this.log('Postprocessfile was not found and could not be used');
							strTextAdd += ' and NOT runned postprocess';
						}
					}
				}
				var currentTime = new Date();

				this.log('Exported ' + strTextAdd + ' ' + this.format_date(currentTime), true);
				this.prefManager.setIntPref("extensions.zoteroautoexporting.file-last", Math.round(currentTime.getTime() / 1000));
				this.filelast = Math.round(currentTime.getTime() / 1000);
			} else
				this.log('Not exported file ' + this.filenslfile.leafName + ' or not exists (#main)', true);
			if ("undefined" !== typeof (ns_zotero_autoexport_toolbar))
				ns_zotero_autoexport_toolbar.icon_stopping();
		} else {
			this.log('Fileobject is not specified or not writeable');
		}
		this.fileexportTimer();
	},
	format_date : function(currentTime) {
		return ((currentTime.getDate() < 10 ? "0" : "") + currentTime.getDate()) + '.' + ((currentTime.getMonth() + 1) < 10 ? "0" : "") + (currentTime.getMonth() + 1) + '.' + currentTime.getFullYear() + ' ' + ((currentTime.getHours() < 10 ? "0" : "") + currentTime.getHours()) + ':' + ((currentTime.getMinutes() < 10 ? "0" : "") + currentTime.getMinutes()) + ':' + currentTime.getSeconds() + ':' + currentTime.getMilliseconds();
	},
	log : function(msg, boolPanel) {
		if (boolPanel == true || this.boolLogAlltoPanel == true) {
			var json_log = JSON.parse(this.prefManager.getCharPref("extensions.zoteroautoexporting.filestatus", '{}'));
			var currentTime = new Date();
			if (json_log.hasOwnProperty(this.format_date(currentTime)))
				json_log[this.format_date(currentTime) + msg.length] = msg;
			else
				json_log[this.format_date(currentTime)] = msg;
			this.prefManager.setCharPref("extensions.zoteroautoexporting.filestatus", JSON.stringify(json_log));
		}
		if (this.boolLog == true) {
			var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			// output to the console if the user defined the option as true
			// (default is false)
			consoleService.logStringMessage('[zoteroautoexporting] ' + msg);
		}
	},
	log_truncate : function() {
		var json_log = JSON.parse(this.prefManager.getCharPref("extensions.zoteroautoexporting.filestatus", '{}'));
		if (Object.keys(json_log).length > 16) {
			for ( var prop in json_log) {
				if (json_log.hasOwnProperty(prop)) {
					delete json_log[prop];
				}
				if (Object.keys(json_log).length < 10)
					break;
			}

			this.prefManager.setCharPref("extensions.zoteroautoexporting.filestatus", JSON.stringify(json_log));
		}

	}
	};
	window.addEventListener("load", function() {
		Zotero.AutoExporting.init();

	}, false);
}
