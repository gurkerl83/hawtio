module Forms {

  export class InputTableConfig {

    public name = 'form';
    public method = 'post';

    // the name of the attribute in the scope which is the data to be editted
    public entity = 'entity';

    // the name of the attribute in the scope which is the table configuration
    public tableConfig = 'tableConfig';

    // set to 'view' or 'create' for different modes
    public mode = 'edit';

    // the definition of the form
    public data:any = {};
    public json:any = undefined;

    public properties = [];
    public action = '';

    public tableclass = 'gridStyle';
    public controlgroupclass = 'control-group';
    public controlclass = 'controls pull-right';
    public labelclass = 'control-label';

    public showtypes = 'true';

    public removeicon = 'icon-remove';
    public editicon = 'icon-edit';
    public addicon = 'icon-plus';

    public removetext = 'Remove';
    public edittext = 'Edit';
    public addtext = 'Add';

    public onadd = 'onadd';
    public onedit = 'onedit';
    public onremove = 'onRemove';

    // TODO - add toggles to turn off add or edit buttons

    public getMode() {
      return this.mode || "edit";
    }

    public getEntity() {
      return this.entity || "entity";
    }

    public isReadOnly() {
      return this.getMode() === "view";
    }

    public getTableConfig() {
      return this.tableConfig || "tableConfig";
    }
  }

  export class InputTable {

    public restrict = 'A';
    public scope = true;
    public replace = true;
    public transclude = true;

    private attributeName = 'inputTable';

    // see constructor for why this is here...
    public link:(scope, element, attrs) => any;

    constructor(private workspace, public $compile) {
      // necessary to ensure 'this' is this object <sigh>
      this.link = (scope, element, attrs) => {
        return this.doLink(scope, element, attrs);
      }
    }

    public sanitize(arg) {
      if (angular.isDefined(arg.formType)) {
        // user-defined input type
        return arg;
      }
      switch ((arg.type || "").toLowerCase()) {
        case "int":
        case "integer":
        case "long":
        case "short":
        case "java.lang.integer":
        case "java.lang.long":
          arg.formType = "number";
          break;
        default:
          arg.formType = "text";
      }

      return arg;
    }

    private doLink(scope, element, attrs) {
      var config = new InputTableConfig;

      var configName = attrs[this.attributeName];
      config = this.configure(config, scope[configName], attrs);

      var entityName = config.getEntity();

      // TODO better name?
      var tableName = entityName;

      if (angular.isDefined(config.json)) {
        config.data = $.parseJSON(config.json);
      } else {
        config.data = scope[config.data];
      }

      var div = $("<div></div>");

      // TODO lets ensure we have some default columns in the column configuration?
      var tableConfig = scope.$eval(configName);
      if (!tableConfig) {
        console.log("No table configuration for table " + tableName);
      }

      var table = this.createTable(config, configName);

      var group = this.getControlGroup(config, {}, "");
      var controlDiv = this.getControlDiv(config);
      controlDiv.addClass('btn-group');
      group.append(controlDiv);

      var add = null;
      var edit = null;
      var remove = null;
      if (!config.isReadOnly()) {
        add = this.getAddButton(config);
        edit = this.getEditButton(config);
        remove = this.getRemoveButton(config);
      }

      var findFunction = function (scope, func) {
        if (angular.isDefined(scope[func]) && angular.isFunction(scope[func])) {
          return scope;
        }
        if (angular.isDefined(scope.$parent) && scope.$parent !== null) {
          return findFunction(scope.$parent, func);
        } else {
          return null;
        }
      };

      function maybeGet(scope, func) {
        if (scope !== null) {
          return scope[func];
        }
        return null;
      }

      var onRemoveFunc = config.onremove.replace('(', '').replace(')', '');
      var onEditFunc = config.onedit.replace('(', '').replace(')', '');
      var onAddFunc = config.onadd.replace('(', '').replace(')', '');

      var onRemove = maybeGet(findFunction(scope, onRemoveFunc), onRemoveFunc);
      var onEdit = maybeGet(findFunction(scope, onEditFunc), onEditFunc);
      var onAdd = maybeGet(findFunction(scope, onAddFunc), onAddFunc);

      if (onRemove === null) {
        onRemove = function () {
          notification('error', 'No remove handler defined for input table ' + tableName);
        }
      }
      if (onEdit === null) {
        onEdit = function () {
          notification('error', 'No edit handler defined for input table ' + tableName);
        }
      }
      if (onAdd === null) {
        onAdd = function (form) {
          notification('error', 'No add handler defined for input table ' + tableName);
        }
      }
      if (add) {
        add.click((event) => {
          onAdd();
          return false;
        });
        controlDiv.append(add);
      }
      if (edit) {
        edit.click((event) => {
          onEdit();
          return false;
        });
        controlDiv.append(edit);
      }
      if (remove) {
        remove.click((event) => {
          onRemove();
          return false;
        });
        controlDiv.append(remove);
      }

      $(div).append(group);
      $(div).append(table);
      $(element).append(div);

      // compile the template
      this.$compile(div)(scope);
    }

    private getAddButton(config) {
      return $('<button type="button" class="btn add"><i class="' + config.addicon + '"></i> ' + config.addtext + '</button>');
    }

    private getEditButton(config) {
      return $('<button type="button" class="btn btn-info edit"><i class="' + config.editicon + '"></i> ' + config.edittext + '</button>');
    }

    private getRemoveButton(config) {
      return $('<button type="remove" class="btn btn-warning remove"><i class="' + config.removeicon + '"></i> ' + config.removetext + '</button>');
    }


    private createTable(config, tableConfig) {
      var table = $('<div class="' + config.tableclass + '" hawtio-datatable="' + tableConfig + '">');
      //table.find('fieldset').append(this.getLegend(config));
      return table;
    }


    private getLegend(config) {
      if (angular.isDefined(config.data.description)) {
        return '<legend>' + config.data.description + '</legend>';
      }
      return '';
    }


    private getControlGroup(config, arg, id) {
      var rc = $('<div class="' + config.controlgroupclass + '"></div>');
      if (angular.isDefined(arg.description)) {
        rc.attr('title', arg.description);
      }
      return rc;
    }

    private getControlDiv(config) {
      return $('<div class="' + config.controlclass + '"></div>');
    }


    private getHelpSpan(config, arg, id) {
      var rc = $('<span class="help-block"></span>');
      if (angular.isDefined(arg.type) && config.showtypes !== 'false') {
        rc.append('Type: ' + arg.type);
      }
      return rc;
    }

    private configure(config, scopeConfig, attrs) {
      if (angular.isDefined(scopeConfig)) {
        config = angular.extend(config, scopeConfig);
      }
      return angular.extend(config, attrs);
    }
  }
}
