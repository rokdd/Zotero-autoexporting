"use strict";
var zotero_autoexport_layout = {
	get_recent_window : function () {
		return Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow('navigator:browser');
	},
	call_xul_id_if_exists : function (xul_id, callback) {
		// try document first
		var xul_elem = document.getElementById(xul_id);

		// prepare the parameters
		if (arguments.length > 2) {
			var params = Array.prototype.slice.call(arguments);
			params.splice(0, 2);
			params = [xul_elem].concat(params);
		} else
			var params = [xul_elem];

		if (xul_elem != null)
			return callback.apply(this, params);

		var xul_elem = this.get_recent_window().document.getElementById(xul_id);
		if (xul_elem != null)
			return callback.apply(this, params);
	}
};

var pref_handler = {
	cache : {},
	prefs_complex_list : {
		'filenslfile' : 'filepathvirtual',
		'postprocessfile' : 'postprocesspathvirtual'
	},
	prefs_string_list : {
		'filestatus' : 'filestatus',
		'filepath' : 'filepath',
		'filenslfile' : 'filenslfile',
		'filetranslator' : 'filetranslator',
		//'file-mode-collection-map' : 'file-mode-collection-map'
	},
	prefs_int_list : {
		'fileinterval' : 'fileinterval',
		'file-last' : 'file-last'
	},
	prefs_bool_list : {

		'postprocess-bool' : 'postprocessbool',
		'showdebug' : 'showdebug',
//		'filedeactivate' : 'filedeactivate',
		'file-event-trigger' : 'file-event-trigger',
		'file-event-timer' : 'file-event-timer',
		'file-bool-collection-map' : 'file-bool-collections-map',
		'file-bool-subcollection-map' : 'file-bool-subcollections-map',
		'file-bool-keep-interval' : 'file-bool-keep-interval'
	},
	saveCollectionlist : function () {
		var tree = document.getElementById("treeCollection");
		// we generate a json..
		var arr_collections = {"Collection":{},"Group":{},"Search":{}};

		// iterate through the treeitems
		for (var i = 0; i < tree.view.rowCount; i++) {
			if (tree.view.getCellValue(i, tree.columns.getColumnAt(0)) == 'true') {

				arr_collections[tree.contentView.getItemAtIndex(i).getAttribute('parent_type')][tree.contentView.getItemAtIndex(i).getAttribute('parent_type')+'_' + tree.contentView.getItemAtIndex(i).id] = {
					'bool-export' : 'true','id': tree.contentView.getItemAtIndex(i).id
				};
				
			}
		}
		var optionString = JSON.stringify(arr_collections);

		this.prefManager.setCharPref("extensions.zoteroautoexporting.collection-profiles", optionString);
	},
	refreshCollectionlist : function () {
		// change by mode the options..
		var treeCollection = document.getElementById("treeCollection");
		var mainCollection = document.getElementById("zotero-autoexporting-file-bool-collection-map");
		var subCollection = document.getElementById("zotero-autoexporting-file-bool-subcollection-map");

		if (document.getElementById("zotero-autoexporting-file-mode-collection-map").value == 'general-collection-settings') {
			treeCollection.disabled = true;
			mainCollection.disabled = false;
			subCollection.disabled = false;
		} else if (document.getElementById("zotero-autoexporting-file-mode-collection-map").value == 'general-once-settings') { 
			treeCollection.disabled = true;
			mainCollection.disabled = true;
			subCollection.disabled = true;
		}
		else  { 
			treeCollection.disabled = false;
			mainCollection.disabled = true;
			subCollection.disabled = true;
		}
		
		
	},
	refreshAddonMode:function()
	{
		if (document.getElementById("zotero-autoexporting-addon-mode").value == '1') {
		//we only want to disable the tabs for triggering 
			document.getElementById('tab_2').disabled=true;
		}
		else
			document.getElementById('tab_2').disabled=false;
	}
	,
	
	loadCollectionlist : function (Zotero, arr_pref, collectionId) {
		var treeCollectionChildren = document.getElementById("treeCollectionChildren");

		var collections = Zotero.getCollections(collectionId);

		for (var c in collections) {

			// setup the new filenames from collection name

			var item = document.createElement("treeitem");
			item.id = '' + collections[c].id;
			item.setAttribute('parent_type','Collection');
			var treeRowL = document.createElement("treerow");
			// now setup false as default

			// activeness?
			var cellActive = document.createElement("treecell");
			
			if (typeof(arr_pref['Collection']['Collection_' + collections[c].id]) != 'undefined' && arr_pref['Collection']['Collection_' + collections[c].id]['bool-export'] == 'true')
				cellActive.setAttribute("value", 'true');
			else
				cellActive.setAttribute("value", 'false');
			
			treeRowL.appendChild(cellActive);

			// title
			var cellTitle = document.createElement("treecell");
			cellTitle.setAttribute("label", collections[c].name);
			cellTitle.setAttribute("editable", 'false');
			treeRowL.appendChild(cellTitle);

			// path simulation
			var cellSim = document.createElement("treecell");
			cellSim.setAttribute("label", collections[c].name.replace(new RegExp('[,/\:*?""<>|]', 'g'), "_"));
			cellSim.setAttribute("editable", 'false');
			treeRowL.appendChild(cellSim);

			// add treeRow to item
			item.appendChild(treeRowL);
			// add item to children list
			treeCollectionChildren.appendChild(item);
			// nest the extensions..
			if (collections[c].hasChildCollections)
				this.loadCollectionlist(Zotero, arr_pref, collections[c].id);
			}
	},
	loadGroupslist : function (Zotero, arr_pref, collectionId,kind) {
		if(kind=="Group")
			{
		var treeCollectionChildren = document.getElementById("treeGroupsChildren");

		var groups = Zotero.Groups.getAll();
			}
		else
			{
			var treeCollectionChildren = document.getElementById("treeSearchesChildren");

			var groups = Zotero.Searches.getAll();
			}
		for (var grou in groups) {

			// setup the new filenames from collection name

			var item = document.createElement("treeitem");
			item.id = '' + groups[grou].id;
			item.setAttribute('parent_type',kind);
			item.setAttribute('parent_id',groups[grou].libraryID);
			
			
			var treeRowL = document.createElement("treerow");
			// now setup false as default

			// activeness?
			var cellActive = document.createElement("treecell");
			if (typeof(arr_pref[kind][kind+'_' + groups[grou].id]) != 'undefined' && arr_pref[kind][kind+'_' + groups[grou].id]['bool-export'] == 'true')
				cellActive.setAttribute("value", 'true');
			else
				cellActive.setAttribute("value", 'false');
			
			treeRowL.appendChild(cellActive);

			// title
			var cellTitle = document.createElement("treecell");
			  
			cellTitle.setAttribute("label", groups[grou].name);
			cellTitle.setAttribute("editable", 'false');
			treeRowL.appendChild(cellTitle);

			// path simulation
			var cellSim = document.createElement("treecell");
			cellSim.setAttribute("label",  groups[grou].name.replace(new RegExp('[,/\:*?""<>|]', 'g'), "_"));
			cellSim.setAttribute("editable", 'false');
			treeRowL.appendChild(cellSim);

			// add treeRow to item
			item.appendChild(treeRowL);
			// add item to children list
			treeCollectionChildren.appendChild(item);
			// nest the extensions..
			
			}
	},
	
	
	batchInit:function()
	{
		
	},
	loadPrefs : function () {
		/*
		 * this.prefs_complex_list=Array(); this.prefs_int_list=Array();
		 * this.prefs_int_list['fileinterval']='fileinterval';
		 * this.prefs_int_list['file-last']='file-last';
		 */
		this.prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		// .getBranch("extensions.zoteroautoexporting.");
		if ("undefined" == typeof(this.Zotero)) {
			if (!("@zotero.org/Zotero;1" in Components.classes)) {
				// alert('Zotero konnte nicht gefunden werden-');
			} else {
				var Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;

			}
		}

		// setup the collections list
		var collections_pref = this.prefManager.getCharPref("extensions.zoteroautoexporting.collection-profiles");
		if (collections_pref) {
			try {
				var collections_pref = JSON.parse(collections_pref);
			} catch (e) {}
		}
		if (typeof(collections_pref) == 'undefined')
			var collections_pref = {};

		this.loadCollectionlist(Zotero, collections_pref, null);
		this.loadGroupslist(Zotero, collections_pref, null,'Group');
		this.loadGroupslist(Zotero, collections_pref, null,'Search');

		// now setups the prefs into this class
		for (var pref_id in this.prefs_int_list)
			if(this.prefManager.getPrefType("extensions.zoteroautoexporting." + this.prefs_int_list[pref_id])==Components.interfaces.nsIPrefBranch.PREF_INT)
			
				if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				document.getElementById('zotero-autoexporting-' + pref_id).value = this.prefManager.getIntPref("extensions.zoteroautoexporting." + this.prefs_int_list[pref_id]);
			
		for (var pref_id in this.prefs_bool_list)
			if(this.prefManager.getPrefType("extensions.zoteroautoexporting." + this.prefs_bool_list[pref_id])==Components.interfaces.nsIPrefBranch.PREF_BOOL)
		
				if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				document.getElementById('zotero-autoexporting-' + pref_id).checked = this.prefManager.getBoolPref("extensions.zoteroautoexporting." + this.prefs_bool_list[pref_id]);
				
		
		for (var pref_id in this.prefs_string_list)
			if(this.prefManager.getPrefType("extensions.zoteroautoexporting." + this.prefs_string_list[pref_id])==Components.interfaces.nsIPrefBranch.PREF_STRING)
			
				if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				document.getElementById('zotero-autoexporting-' + pref_id).value = this.prefManager.getCharPref("extensions.zoteroautoexporting." + this.prefs_string_list[pref_id]);
		
		for (var pref_id in this.prefs_complex_list)
			this.init_file('extensions.zoteroautoexporting.' + pref_id, 'zoteroautoexporting.' + this.prefs_complex_list[pref_id]);
		
		//load the mode
		if (document.getElementById('zotero-autoexporting-addon-mode') != null)
			document.getElementById('zotero-autoexporting-addon-mode').value = this.prefManager.getIntPref("extensions.zoteroautoexporting.addon-mode");

		if (document.getElementById('zotero-autoexporting-file-mode-collection-map') != null)
			 document.getElementById('zotero-autoexporting-file-mode-collection-map').value=this.prefManager.getCharPref("extensions.zoteroautoexporting.file-mode-collection-map");

		// load the box with latest logs
		this.init_status();

		this.refreshCollectionlist();

		// arrange the menu with zotero translators
		var selectedTranslator = this.prefManager.getCharPref("extensions.zoteroautoexporting.filetranslator");

		if ("undefined" != typeof(Zotero)) {
			var translators = Zotero.Translators.getAllForType('export');
			translators.sort(function (a, b) {
				return a.label.localeCompare(b.label)
			});
			var formatPopup = document.getElementById("format-popup");
			var optionsBox = document.getElementById("translator-options");
			var charsetBox = document.getElementById("charset-box");
			const OPTION_PREFIX = "export-option-";
			var addedOptions = new Object();
			// add styles to format popup
			this.translators = translators;
			for (var i in translators) {
				var itemNode = document.createElement("menuitem");
				itemNode.setAttribute("label", translators[i].label);
				itemNode.setAttribute("value", translators[i].translatorID);
				formatPopup.appendChild(itemNode);

				// add options
				for (var option in translators[i].displayOptions) {
					if (!addedOptions[option]) { // if this option is not
													// already
						// presented to the user
						// get readable name for option
						try {
							var optionLabel = Zotero.getString("exportOptions." + option);
						} catch (e) {
							var optionLabel = option;
						}

						// right now, option interface supports only boolean
						// values, which
						// it interprets as checkboxes
						if (typeof(translators[i].displayOptions[option]) == "boolean") {
							var checkbox = document.createElement("checkbox");
							checkbox.setAttribute("id", OPTION_PREFIX + option);
							checkbox.setAttribute("label", optionLabel);
							optionsBox.insertBefore(checkbox, charsetBox);
						}

						addedOptions[option] = true;
					}
				}

				if (translators[i].translatorID == selectedTranslator) {
					document.getElementById("format-menu").selectedIndex = i;
				}
				// from charsetMenu.js
				/*
				 * if(Zotero.Prefs.get("export.displayCharsetOption")) {
				 * _charsets =
				 * Zotero_Charset_Menu.populate(document.getElementById(OPTION_PREFIX+"exportCharset"),
				 * true); }
				 */
			}
			// just load the advanced options.. PART OF ZOTERO, but configured
			// for this extension..

			this.updateOptions();
		}
	},
	updateOptions : function () {
		// get selected translator
		const OPTION_PREFIX = "export-option-";
		var index = document.getElementById("format-menu").selectedIndex;
		var translatorOptions = this.translators[index].displayOptions;
		var optionString = this.prefManager.getCharPref("extensions.zoteroautoexporting.file-advancedoptions");
		if (optionString) {
			try {
				var options = JSON.parse(optionString);
			} catch (e) {}
		}

		var optionsBox = document.getElementById("translator-options");
		optionsBox.hidden = true;
		var haveOption = false;
		for (var i = 0; i < optionsBox.childNodes.length; i++) {
			// loop through options to see which should be enabled
			var node = optionsBox.childNodes[i];
			// skip non-options
			if (node.id.length <= OPTION_PREFIX.length
				 || node.id.substr(0, OPTION_PREFIX.length) != OPTION_PREFIX) {
				continue;
			}

			var optionName = node.id.substr(OPTION_PREFIX.length);
			if (translatorOptions[optionName] != undefined) {
				// option should be enabled
				optionsBox.hidden = undefined;
				node.hidden = undefined;

				var defValue = translatorOptions[optionName];
				if (typeof(defValue) == "boolean") {
					if (options && options[optionName] !== undefined) {
						// if there's a saved prefs string, use it
						var isChecked = options[optionName];
					} else {
						// use defaults
						var isChecked = (defValue ? "true" : "false");
					}
					node.setAttribute("checked", isChecked);
				}
			} else {
				// option should be disabled and unchecked to prevent confusion
				node.hidden = true;
				node.checked = false;
			}
		}

		// handle charset popup
		/*
		 * if (_charsets && translatorOptions.exportCharset) { optionsBox.hidden =
		 * undefined; document.getElementById("charset-box").hidden = undefined;
		 * var charsetMenu = document.getElementById(OPTION_PREFIX +
		 * "exportCharset"); var charset = "UTF-8"; if (options &&
		 * options.exportCharset && _charsets[options.exportCharset]) { charset =
		 * options.exportCharset; } else if (translatorOptions.exportCharset &&
		 * _charsets[translatorOptions.exportCharset]) { charset =
		 * translatorOptions.exportCharset; }
		 * 
		 * charsetMenu.selectedItem = _charsets[charset]; } else {
		 * document.getElementById("charset-box").hidden = true; }
		 */

	},
	batchAccept : function () {
		if ("undefined" == typeof(this.Zotero)) {
			if (!("@zotero.org/Zotero;1" in Components.classes)) {
				 alert('Zotero konnte nicht gefunden werden');
			} else {
				var Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;

			}
		}
		Zotero.AutoExporting.autoexport();
	},
	onAccept : function () {
		const OPTION_PREFIX = "export-option-";
		// now save all values
		for (var pref_id in this.prefs_int_list)
			if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				this.prefManager.setIntPref("extensions.zoteroautoexporting." + this.prefs_int_list[pref_id], document.getElementById('zotero-autoexporting-' + pref_id).value);
		
		for (var pref_id in this.prefs_bool_list)
			if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				this.prefManager.setBoolPref("extensions.zoteroautoexporting." + this.prefs_bool_list[pref_id], document.getElementById('zotero-autoexporting-' + pref_id).checked);
		

		for (var pref_id in this.prefs_string_list)
			if (document.getElementById('zotero-autoexporting-' + pref_id) != null)
				this.prefManager.setCharPref("extensions.zoteroautoexporting." + this.prefs_string_list[pref_id], document.getElementById('zotero-autoexporting-' + pref_id).value);


		for (var pref_id in this.prefs_complex_list)
			if (this.cache['pref_' + 'extensions.zoteroautoexporting.' + pref_id] != null)
				this.prefManager.setComplexValue('extensions.zoteroautoexporting.' + pref_id, Components.interfaces.nsILocalFile, this.cache['pref_' + 'extensions.zoteroautoexporting.' + pref_id]);
			else
				this.prefManager.clearUserPref('extensions.zoteroautoexporting.' + pref_id);

		// save the choosen translator
		this.prefManager.setCharPref("extensions.zoteroautoexporting.filetranslator", document.getElementById("format-menu").selectedItem.value);
		
		if (document.getElementById('zotero-autoexporting-addon-mode') != null)
			 this.prefManager.setIntPref("extensions.zoteroautoexporting.addon-mode",document.getElementById('zotero-autoexporting-addon-mode').value);

		if (document.getElementById('zotero-autoexporting-file-mode-collection-map') != null)
			 this.prefManager.setCharPref("extensions.zoteroautoexporting.file-mode-collection-map",document.getElementById('zotero-autoexporting-file-mode-collection-map').value);

		
		// save the advanced options
		var index = document.getElementById("format-menu").selectedIndex;

		// save the collection options
		this.saveCollectionlist();

		// set options on selected translator and generate optionString
		var optionsAvailable = this.translators[index].displayOptions;
		var displayOptions = {};
		for (var option in optionsAvailable) {
			var defValue = optionsAvailable[option];
			var element = document.getElementById(OPTION_PREFIX + option);

			if (option == "exportCharset") {
				continue;
				if (_charsets) {
					displayOptions[option] = element.selectedItem.value;
				} else {
					displayOptions[option] = optionsAvailable[option];
				}
			} else if (typeof(defValue) == "boolean") {
				displayOptions[option] = !!element.checked;
			}
		}

		// save options
		var optionString = JSON.stringify(displayOptions);
		this.prefManager.setCharPref("extensions.zoteroautoexporting.file-advancedoptions", optionString);

	},
	onCancel : function () {},
	open_url : function (aUrl) {
		window.opener.openURL(aUrl);
	},
	test_export : function () {
		if ("undefined" == typeof(Zotero)) {
			var Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;

		}
		if ("undefined" == typeof(Zotero)) {
			alert('Zotero could not be found and the test does not run');
		} else {
			// apply the latest settings
			this.onAccept();

			alert('Now the settings are saved and we just run..');
			// set that we are log all
			Zotero.AutoExporting.boolLogAlltoPanel = true;
			Zotero.AutoExporting.log('----- Test run-------');
			if (Zotero.AutoExporting.renew_timer('Manually run and prefs might be changed') != false)
				Zotero.AutoExporting.autoexport();

			Zotero.AutoExporting.boolLogAlltoPanel = false;
			this.init_status();
			alert('The tests ends');
		}
	},
	select_format : function () {

		/*
		 * var optionsAvailable =
		 * window.arguments[0].selectedTranslator.displayOptions; var
		 * displayOptions = window.arguments[0].displayOptions = {}; for(var
		 * option in optionsAvailable) { var defValue =
		 * optionsAvailable[option]; var element =
		 * document.getElementById(OPTION_PREFIX+option);
		 * 
		 * if(option == "exportCharset") { if(_charsets) {
		 * displayOptions[option] = element.selectedItem.value; } else {
		 * displayOptions[option] = optionsAvailable[option]; } } else
		 * if(typeof(defValue) == "boolean") { displayOptions[option] =
		 * !!element.checked; } }
		 *  // save options var optionString = JSON.stringify(displayOptions);
		 * Zotero.Prefs.set("export.translatorSettings", optionString); #
		 */
	},
	select_file : function (prefid, prefbox, mode) {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		// var prefs =
		// Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.zoteroautoexporting.");
		if (mode == 'select') {
			fp.init(window, "Browse file", nsIFilePicker.modeOpen);
		} else {
			fp.init(window, "Export file", nsIFilePicker.modeSave);
		}
		fp.appendFilters(nsIFilePicker.filterText | nsIFilePicker.filterAll);

		// set the default path from current file in the cache
		if (this.cache['pref_' + prefid] != null)
			fp.displayDirectory = this.cache['pref_' + prefid].parent;

		var res = fp.show();
		if (res == nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace) {
			// update the textbox on prefs page
			// document.getElementById(prefbox).value = fp.file.path;
			zotero_autoexport_layout.call_xul_id_if_exists(prefbox, function (elem, fp) {
				elem.value = fp.file.path;
			}, fp);
			// update the cache
			this.cache['pref_' + prefid] = fp.file;
		}
	},
	reset_file : function (prefid, prefbox) {
		zotero_autoexport_layout.call_xul_id_if_exists(prefbox, function (elem) {
			elem.value = 'not set yet';
		});
		// update the cache
		this.cache['pref_' + prefid] = null;
	},
	init_file : function (prefid, prefbox) {

		if (this.prefManager.prefHasUserValue(prefid)) {
			var temp = this.prefManager.getComplexValue(prefid, Components.interfaces.nsILocalFile);
			if (temp.path.length > 0) {
				zotero_autoexport_layout.call_xul_id_if_exists(prefbox, function (elem, temp) {
					elem.value = temp.path;
				}, temp);
				this.cache['pref_' + prefid] = temp;
				return true;
			}
		}
		// etablish cache if the file is selected new;
		this.cache['pref_' + prefid] = null;
		zotero_autoexport_layout.call_xul_id_if_exists(prefbox, function (elem) {
			elem.value = 'not set yet';
		});
	},
	init_status : function () {
		// set the logbox
		var logboxtext = '';

		var json_log = JSON.parse(this.prefManager.getCharPref("extensions.zoteroautoexporting.filestatus", '{}'));

		var sort_keys = new Array();
		var sort_obj = {};

		for (var i in json_log) {
			sort_keys.push(i);
		}
		sort_keys.sort(function (a, b) {
			return b - a
		});
		for (var k in sort_keys) {
			sort_obj[sort_keys[k]] = json_log[sort_keys[k]];
		}
		for (var i_log in sort_obj)
			logboxtext += i_log + ':   ' + sort_obj[i_log] + "\n";
		zotero_autoexport_layout.call_xul_id_if_exists('zoteroautoexporting.filestatus', function (elem) {
			elem.value = logboxtext;
	        });

}
};
