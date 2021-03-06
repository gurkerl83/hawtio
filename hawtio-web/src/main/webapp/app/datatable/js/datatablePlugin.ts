module DataTable {
  var pluginName = 'datatable';
  angular.module(pluginName, ['bootstrap', 'ngResource', 'hawtioCore']).
          directive('hawtioDatatable', function (workspace, $timeout, $filter, $compile) {
            // return the directive link function. (compile function not needed)
            return function (scope, element, attrs) {
              var gridOptions = null;
              var data = null;
              var widget = null;
              var timeoutId = null;
              var initialised = false;
              var childScopes = [];
              var rowDetailTemplate = null;
              var rowDetailTemplateId = null;
              var selectedItems = null;

              // used to update the UI
              function updateGrid() {
                // console.log("updating the grid!!");
                Core.$applyNowOrLater(scope);
              }

              function convertToDataTableColumn(columnDef) {
                var data = {
                  mData: columnDef.field,
                  sDefaultContent: ""
                };
                var name = columnDef.displayName;
                if (name) {
                  data["sTitle"] = name;
                }
                var width = columnDef.width;
                if (angular.isNumber(width)) {
                  data["sWidth"] = "" + width + "px";
                } else if (angular.isString(width) && !width.startsWith("*")) {
                  data["sWidth"] = width;
                }
                var template = columnDef.cellTemplate;
                if (template) {
                  data["fnCreatedCell"] = function (nTd, sData, oData, iRow, iCol) {
                    var childScope = childScopes[iRow];
                    if (!childScope) {
                      childScope = scope.$new(false);
                      childScopes[iRow] = childScope;
                    }
                    var entity = oData;
                    childScope["row"] = {
                      entity: entity,

                      getProperty: (name) => {
                        return entity[name];
                      }
                    };

                    var elem = $(nTd);
                    elem.html(template);
                    var contents = elem.contents();
                    contents.removeClass("ngCellText");
                    $compile(contents)(childScope);
                  };
                } else {
                  var cellFilter = columnDef.cellFilter;
                  if (cellFilter) {
                    var filter = $filter(cellFilter);
                    if (filter) {
                      data["mRender"] = function (data, type, full) {
                        return filter(data);
                      }
                    }
                  }
                }
                return data;
              }

              function destroyChildScopes() {
                angular.forEach(childScopes, (childScope) => {
                  childScope.$destroy();
                });
                childScopes = [];
              }

              function selectHandler(selection) {
                if (selection && selectedItems) {
                  selectedItems.splice(0, selectedItems.length);
                  selectedItems.push(selection);
                  Core.$apply(scope);
                }
              }

              function onTableDataChange(value) {
                gridOptions = value;
                if (gridOptions) {
                  selectedItems = gridOptions.selectedItems;
                  rowDetailTemplate = gridOptions.rowDetailTemplate;
                  rowDetailTemplateId = gridOptions.rowDetailTemplateId;

                  // TODO deal with updating the gridOptions on the fly?
                  if (widget === null) {
                    var widgetOptions = {
                      selectHandler: selectHandler,
                      disableAddColumns: true,
                      rowDetailTemplateId: rowDetailTemplateId,
                      ignoreColumns: gridOptions.ignoreColumns,
                      flattenColumns: gridOptions.flattenColumns
                    };

                    // lets find a child table element
                    // or lets add one if there's not one already
                    var rootElement = $(element);
                    var tableElement = rootElement.children("table");
                    if (!tableElement.length) {
                      $("<table class='table table-bordered table-condensed'></table>").appendTo(rootElement);
                      tableElement = rootElement.children("table");
                    }
                    tableElement.removeClass('table-striped');
                    tableElement.addClass('dataTable');
                    var trElement = Core.getOrCreateElements(tableElement, ["thead", "tr"]);

                    destroyChildScopes();

                    // convert the column configurations
                    var columns = [];
                    var columnCounter = 1;
                    if (rowDetailTemplate || rowDetailTemplateId) {
                      columns.push(
                              {
                                "mDataProp": null,
                                "sClass": "control center",
                                "sWidth": "30px",
                                "sDefaultContent": '<i class="icon-plus"></i>'
                              });

                      var th = trElement.children("th");
                      if (th.length < columnCounter++) {
                        $("<th></th>").appendTo(trElement);
                      }
                    }
                    angular.forEach(gridOptions.columnDefs, (columnDef) => {
                      // if there's not another <tr> then lets add one
                      th = trElement.children("th");
                      if (th.length < columnCounter++) {
                        var name = columnDef.displayName || "";
                        $("<th>" + name + "</th>").appendTo(trElement);
                      }
                      columns.push(convertToDataTableColumn(columnDef));
                    });
                    widget = new TableWidget(scope, workspace, columns, widgetOptions);
                    widget.tableElement = tableElement;

                    // if all the column definitions have an sWidth then lets turn off
                    // the auto-width calculations
                    if (columns.every(col => col.sWidth)) {
                      widget.dataTableConfig.bAutoWidth = false;
                    }

                    /*
                    // lets avoid word wrap
                    widget.dataTableConfig["fnCreatedRow"] = function( nRow, aData, iDataIndex ) {
                      var cells = $(nRow).children("td");
                      cells.css("overflow", "hidden");
                      cells.css("white-space", "nowrap");
                      cells.css("text-overflow", "ellipsis");
                    };
                    */

                    var filterText = null;
                    var filterOptions = gridOptions.filterOptions;
                    if (filterOptions) {
                      filterText = filterOptions.filterText;
                    }
                    if (filterText || (angular.isDefined(gridOptions.showFilter) && !gridOptions.showFilter)) {
                       // disable the text filter box
                       widget.dataTableConfig.sDom = 'Rlrtip';
                    }
                    if (filterText) {
                      scope.$watch(filterText, function (value) {
                        var dataTable = widget.dataTable;
                        if (dataTable) {
                          dataTable.fnFilter(value);
                        }
                      });
                    }
                    if (angular.isDefined(gridOptions.displayFooter) && !gridOptions.displayFooter && widget.dataTableConfig.sDom) {
                      // remove the footer
                      widget.dataTableConfig.sDom = widget.dataTableConfig.sDom.replace('i', '');
                    }

                    // TODO....
                    // lets make sure there is enough th headers for the columns!
                  }
                  if (!data) {
                    // TODO deal with the data name changing one day?
                    data = gridOptions.data;
                    if (data) {
                      scope.$watch(data, function (value) {
                        if (initialised || (value && value.length)) {
                          initialised = true;
                          destroyChildScopes();
                          widget.populateTable(value);
                          updateLater();
                        }
                      });
                    }
                  }
                }
                updateGrid();
              }

              // watch the expression, and update the UI on change.
              scope.$watch(attrs.hawtioDatatable, onTableDataChange);

              // schedule update in one second
              function updateLater() {
                // save the timeoutId for canceling
                timeoutId = $timeout(function () {
                  updateGrid(); // update DOM
                }, 300);
              }

              // listen on DOM destroy (removal) event, and cancel the next UI update
              // to prevent updating ofter the DOM element was removed.
              element.bind('$destroy', function () {
                destroyChildScopes();
                $timeout.cancel(timeoutId);
              });

              updateLater(); // kick off the UI update process.
            }
          }
  ).run(function(helpRegistry) {
        helpRegistry.addDevDoc(pluginName, 'app/datatable/doc/developer.md');
      });

  hawtioPluginLoader.addModule(pluginName);
}
