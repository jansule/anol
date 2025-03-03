import './module.js';
import {PopupsService} from '../featurepopup/featurepopup-service.js';

angular.module('anol.map')

    /**
     * @ngdoc object
     * @name anol.map.LayersServiceProvider
     */
    .provider('LayersService', [function () {
        var _layers = [];
        var _addLayerHandlers = [];
        var _removeLayerHandlers = [];
        var _clusterDistance = 50;

        /**
         * Create a layer from a munimap layer configuration.
         * @param {Object} layerConf The munimap layer configuration.
         * @returns {anol.layer.Layer} The created layer.
         */
        const createLayer = (layerConf) => {
            switch (layerConf.type) {
                case 'wms':
                    return new anol.layer.SingleTileWMS(layerConf);
                case 'tiledwms':
                    return new anol.layer.TiledWMS(layerConf);
                case 'wmts':
                    return new anol.layer.WMTS(layerConf);
                case 'dynamic_geojson':
                    return new anol.layer.DynamicGeoJSON(layerConf);
                case 'static_geojson':
                case 'digitize':
                    return new anol.layer.StaticGeoJSON(layerConf);
                case 'sensorthings':
                    return new anol.layer.SensorThings(layerConf);
                default:
                    break;
            }
        };

        /**
         * Create a group from a munimap group configuration.
         * @param {Object} groupConf The munimap group configuration.
         * @returns {anol.layer.Group} The created group.
         */
        const createGroup = (groupConf) => {
            const groupOpts = {
                layers: groupConf.layers.map(createLayer).filter(l => l !== undefined),
                collapsed: true,
                showGroup: groupConf.showGroup,
                metadataUrl: groupConf.metadataUrl,
                abstract: groupConf.abstract,
                singleSelect: groupConf.singleSelect,
                singleSelectGroup: groupConf.singleSelectGroup,
                name: groupConf.name,
                title: groupConf.title,
                legend: groupConf.legend,
                defaultVisibleLayers: groupConf.defaultVisibleLayers
            };

            if (groupConf.catalog) {
                groupOpts.catalog = groupConf.catalog;
            }

            if (groupConf.catalogLayer) {
                groupOpts.catalogLayer = groupConf.catalogLayer;
            }

            return new anol.layer.Group(groupOpts);
        };

        /**
         * Create a draw layer from a munimap draw layer configuration.
         * @param {Object} drawLayerConf The munimap draw layer configuration.
         * @returns {anol.layer.StaticGeoJSON} The created draw layer.
         */
        const createDrawLayer = (drawLayerConf) => {
            const layerOpts = {
                title: drawLayerConf.title,
                name: drawLayerConf.name,
                displayInLayerswitcher: false,
                propertiesSchema: drawLayerConf.properties_schema,
                propertiesSchemaFormOptions: drawLayerConf.properties_schema_form_options,
                geomType: drawLayerConf.geom_type,
                externalGraphicPrefix: drawLayerConf.externalGraphicPrefix,
                editable: true,
                saveable: true,
                olLayer: {
                    source: {
                        dataProjection: 'EPSG:25832',
                        url: drawLayerConf.url
                    }
                }
            };

            if (drawLayerConf.style) {
                layerOpts.style = drawLayerConf.style;
            }

            return new anol.layer.StaticGeoJSON(layerOpts);
        }

        /**
         * Initialize the background layers from the munimap background configurations.
         * @param {Object[]} munimapBackgroundConfigs
         * @returns The initialized background layers.
         */
        this.initBackgroundLayers = function (munimapBackgroundConfigs) {
            const backgroundLayers = munimapBackgroundConfigs
                .map(createLayer)
                .filter(l => l !== undefined);
            return backgroundLayers;
        };

        /**
         * Initialize the overlay layers from the munimap overlay configurations.
         * @param {Object[]} munimapOverlayConfigs
         * @returns The initialized overlay layers.
         */
        this.initOverlayLayers = function (munimapOverlayConfigs) {
            const overlayLayers = munimapOverlayConfigs.map(createGroup);
            return overlayLayers;
        };

        /**
         * Initialize the draw layers from the munimap draw layer configurations.
         * @param {Object[]} munimapDrawLayerConfigs The munimap draw layer configurations.
         * @returns The initialized draw layers.
         */
        this.initDrawLayers = function (munimapDrawLayerConfigs) {
            const drawLayers = munimapDrawLayerConfigs.map(createDrawLayer);
            return drawLayers;
        };

        /**
         * @ngdoc method
         * @name setLayers
         * @methodOf anol.map.LayersServiceProvider
         * @param {Array.<Object>} layers ol3 layers
         */
        this.setLayers = function (layers) {
            _layers = _layers.concat(layers);
        };
        this.setClusterDistance = function (distance) {
            _clusterDistance = distance;
        };
        /**
         * @ngdoc method
         * @name registerAddLayerHandler
         * @methodOf anol.map.LayersServiceProvider
         * @param {function} handler
         * register a handler called for each added layer
         */
        this.registerAddLayerHandler = function (handler) {
            _addLayerHandlers.push(handler);
        };

        this.registerRemoveLayerHandler = function (handler) {
            _removeLayerHandlers.push(handler);
        };

        this.$get = ['$rootScope', 'PopupsService', function ($rootScope, PopupsService) {
            /**
             * @ngdoc service
             * @name anol.map.LayersService
             *
             * @description
             * Stores ol3 layers and add them to map, if map present
             */
            var Layers = function (layers, addLayerHandlers, removeLayerHandlers, clusterDistance) {
                var self = this;
                self.map = undefined;
                self.addLayerHandlers = addLayerHandlers;
                self.removeLayerHandlers = removeLayerHandlers;
                self.clusterDistance = clusterDistance;

                // contains all anol background layers
                self.backgroundLayers = [];
                // contains all anol overlay layers or groups
                self.overlayLayers = [];
                // contains all deleted anol overlay layers or groups
                self.deletedOverlayLayers = [];
                // contains all anol layers used internaly by modules
                self.systemLayers = [];
                self.nameLayersMap = {};
                self.nameGroupsMap = {};

                self.olLayers = [];
                self.idx = 0;
                self.addedLayers = [];

                angular.forEach(layers, function (layer) {
                    if (layer.isBackground) {
                        self.addBackgroundLayer(layer);
                    } else if (layer.isSystem) {
                        self.addSystemLayer(layer);
                    } else {
                        self.addOverlayLayer(layer);
                    }
                });
                self.reorderGroupLayers();

                var activeBackgroundLayer;
                angular.forEach(self.backgroundLayers, function (backgroundLayer) {
                    if (angular.isUndefined(activeBackgroundLayer) && backgroundLayer.getVisible()) {
                        activeBackgroundLayer = backgroundLayer;
                    }
                });
                if (angular.isUndefined(activeBackgroundLayer) && self.backgroundLayers.length > 0) {
                    activeBackgroundLayer = self.backgroundLayers[0];
                }
                angular.forEach(self.backgroundLayers, function (backgroundLayer) {
                    backgroundLayer.setVisible(angular.equals(activeBackgroundLayer, backgroundLayer));
                });

                $rootScope.layersReady = true;
            };
            /**
             * @ngdoc method
             * @name registerMap
             * @methodOf anol.map.LayersService
             * @param {Object} map ol3 map object
             * @description
             * Register an ol3 map in `LayersService`
             */
            Layers.prototype.registerMap = function (map) {
                var self = this;
                self.map = map;
                angular.forEach(self.backgroundLayers, function (layer) {
                    if (angular.isUndefined(layer)) {
                        return true;
                    }
                    self._addLayer(layer, true);
                });
                angular.forEach(self.overlayLayers, function (layer) {
                    if (angular.isUndefined(layer)) {
                        return true;
                    }

                    if (layer instanceof anol.layer.Group) {
                        angular.forEach(layer.layers.slice().reverse(), function (grouppedLayer) {
                            if (self.olLayers.indexOf(grouppedLayer.olLayer) < 0) {
                                self._addLayer(grouppedLayer, false);
                            }
                        });
                    } else {
                        if (self.olLayers.indexOf(layer.olLayer) < 0) {
                            self._addLayer(layer, false);
                        }
                    }
                });
                angular.forEach(self.systemLayers, function (layer) {
                    self._addLayer(layer, true);
                });
            };
            /**
             * @ngdoc method
             * @name addBackgroundLayer
             * @methodOf anol.map.LayersService
             * @param {anol.layer} layer Background layer to add
             * @param {number} idx Position to add background layer at
             * @description
             * Adds a background layer
             */
            Layers.prototype.addBackgroundLayer = function (layer, idx) {
                var self = this;
                idx = idx || self.backgroundLayers.length;
                self.backgroundLayers.splice(idx, 0, layer);
                self._prepareLayer(layer);
            };
            /**
             * @ngdoc method
             * @name addOverlayLayer
             * @methodOf anol.map.LayersService
             * @param {anol.layer} layer Overlay layer to add
             * @param {number} idx Position to add overlay layer at
             * @description
             * Adds a overlay layer
             */
            Layers.prototype.addOverlayLayer = function (layer, idx) {
                var self = this;
                // prevent adding layer twice
                if (self.overlayLayers.indexOf(layer) > -1) {
                    return false;
                }

                // layers added reversed to map, so default idx is 0 to add layer "at top"
                if (idx === undefined) {
                    self.overlayLayers.push(layer)
                } else {
                    if (idx > self.overlayLayers.length) {
                        idx = self.overlayLayers.length;
                    }
                    self.overlayLayers.splice(idx, 0, layer);
                }
                self._prepareLayer(layer);

                if (layer instanceof anol.layer.Group) {
                    angular.forEach(layer.layers, function (_layer) {
                        _layer.onVisibleChange(function () {
                            PopupsService.closeAll();
                        });
                    });
                } else {
                    layer.onVisibleChange(function () {
                        PopupsService.closeAll();
                    });
                }
                return true;
            };
            Layers.prototype.removeOverlayLayer = function (layer) {
                var self = this;

                if (layer instanceof anol.layer.Group) {
                    var group = layer;
                    if (self.overlayLayers.indexOf(group) === -1) {
                        return false;
                    }
                    if (angular.isDefined(group.name)) {
                        delete self.nameGroupsMap[group.name];
                    }

                    var overlayLayerIdx = self.overlayLayers.indexOf(group);
                    if (overlayLayerIdx > -1) {
                        self.overlayLayers.splice(overlayLayerIdx, 1);
                        if (!layer.catalogLayer) {
                            self.deletedOverlayLayers.push(group.name)
                        }
                    }
                    angular.forEach(group.layers, function (_layer) {
                        // _layer.setVisible(false);
                        if (angular.isDefined(self.map)) {
                            var olLayerIdx = self.olLayers.indexOf(_layer.olLayer);
                            if (olLayerIdx > -1) {
                                self.map.removeLayer(_layer.olLayer);
                                self.olLayers.splice(olLayerIdx, 1);
                                delete self.nameLayersMap[_layer.name];
                            }
                        }
                        angular.forEach(self.removeLayerHandlers, function (handler) {
                            handler(_layer);
                        });
                        _layer.removeOlLayer();
                        if (!layer.catalogLayer) {
                            self.deletedOverlayLayers.push(_layer.name);
                        }
                    });
                    return true;
                } else {
                    var addedLayersIdx = self.addedLayers.indexOf(layer);
                    if (addedLayersIdx > -1) {
                        self.addedLayers.splice(addedLayersIdx, 1);
                    }

                    delete self.nameLayersMap[layer.name];

                    // remove single layer
                    var overlayLayerIdx = self.overlayLayers.indexOf(layer);
                    if (overlayLayerIdx > -1) {
                        self.overlayLayers.splice(overlayLayerIdx, 1);
                        if (angular.isDefined(self.map)) {
                            var olLayerIdx = self.olLayers.indexOf(layer.olLayer);
                            if (olLayerIdx > -1) {
                                self.map.removeLayer(layer.olLayer);
                                self.olLayers.splice(olLayerIdx, 1);
                            }
                        }
                    }

                    // remove layer in group
                    const groups = self.overlayLayers
                        .filter(l => l instanceof anol.layer.Group);

                    for (const group of groups) {
                        const groupIndex = group.layers.indexOf(layer);
                        if (groupIndex < 0) {
                            continue;
                        }

                        if (!layer.combined) {
                            // remove not combined layer directly
                            const olIndex = self.olLayers.indexOf(layer.olLayer);
                            if (olIndex > -1) {
                                self.map.removeLayer(layer.olLayer);
                                self.olLayers.splice(olIndex, 1);
                            }
                        }
                        group.layers.splice(groupIndex, 1);
                        layer.removeOlLayer();
                        if (!layer.catalogLayer) {
                            self.deletedOverlayLayers.push(layer.name);
                        }

                        if (group.layers.length === 0) {
                            self.removeOverlayLayer(group);
                        }
                    }

                    // remove empty combined openlayers layer
                    if (layer.olLayer) {
                        var olSource = layer.olLayer.getSource();
                        var anolLayers = olSource.get('anolLayers');
                        if (anolLayers.length === 0 && angular.isDefined(self.map)) {
                            var olLayerIdx = self.olLayers.indexOf(layer.olLayer);
                            if (olLayerIdx > -1) {
                                self.map.removeLayer(layer.olLayer);
                                self.olLayers.splice(olLayerIdx, 1);
                            }
                        }
                    }
                    angular.forEach(self.overlayLayers, function (layer, idx) {
                        if (layer instanceof anol.layer.Group && layer.layers.length === 0) {
                            self.overlayLayers.splice(idx, 1);
                        }
                    });

                    angular.forEach(self.removeLayerHandlers, function (handler) {
                        handler(layer);
                    });
                }
            };
            /**
             * @ngdoc method
             * @name addSystemLayer
             * @methodOf anol.map.LayersService
             * @param {anol.layer} layer Overlay layer to add
             * @param {number} idx Position to add overlay layer at
             * @description
             * Adds a system layer. System layers should only created and added by
             * anol components
             */
            Layers.prototype.addSystemLayer = function (layer, idx) {
                var self = this;
                if (angular.isUndefined(layer.olLayer)) {
                    self._prepareLayer(layer);
                }
                idx = idx || 0;
                self.systemLayers.splice(idx, 0, layer);
            };

            Layers.prototype.getSystemLayerByName = function (layername) {
                var self = this;
                var systemlayer = undefined;
                angular.forEach(self.systemLayers, function (layer, idx) {
                    if (layer.name === layername) {
                        systemlayer = layer;
                    }
                });
                return systemlayer
            };

            /**
             * @ngdoc method
             * @name removeSystemLayer
             * @methodOf anol.map.LayersService
             * @param {anol.Layer} layer The system layer to remove.
             * @description
             * Removes a system layer.
             */
            Layers.prototype.removeSystemLayer = function (layer) {
              var self = this;
              var systemLayerIdx = self.systemLayers.indexOf(layer);
              if (systemLayerIdx < 0) {
                return;
              }
              self.systemLayers.splice(systemLayerIdx, 1);

              self.map.removeLayer(layer.olLayer);

              var olLayerIdx = self.olLayers.indexOf(layer.olLayer);
              if (olLayerIdx > -1) {
                self.olLayers.splice(olLayerIdx, 1);
              }

              var addedLayersIdx = self.addedLayers.indexOf(layer);
              if (addedLayersIdx > -1) {
                  self.addedLayers.splice(addedLayersIdx, 1);
              }
            };
            /**
             * private function
             * Creates olLayer
             */
            Layers.prototype.createOlLayer = function (layer) {
                var olSource;
                var lastAddedLayer = this.lastAddedLayer();
                if (angular.isDefined(lastAddedLayer) && lastAddedLayer.isCombinable(layer)) {
                    olSource = lastAddedLayer.getCombinedSource(layer);
                    if (layer instanceof anol.layer.DynamicGeoJSON && layer.isClustered()) {
                        layer.unclusteredSource = lastAddedLayer.unclusteredSource;
                    }
                    layer.combined = true;
                    lastAddedLayer.combined = true;
                }

                if (angular.isUndefined(olSource)) {
                    var sourceOptions = angular.extend({}, layer.olSourceOptions);
                    if (layer.isClustered()) {
                        sourceOptions.distance = this.clusterDistance;
                    }
                    olSource = new layer.OL_SOURCE_CLASS(sourceOptions);
                    olSource.set('anolLayers', [layer]);
                }
                var layerOpts = angular.extend({}, layer.olLayerOptions);
                layerOpts.source = olSource;
                var olLayer = new layer.OL_LAYER_CLASS(layerOpts);
                // only instances of BaseWMS are allowed to share olLayers
                // TODO allow also DynamicGeoJSON layer to share olLayers
                //     if(layer.combined && layer instanceof anol.layer.BaseWMS &&
                //    angular.equals(layer.olLayerOptions,lastAddedLayer.olLayerOptions)
                //     ) {
                //         layer.setOlLayer(lastAddedLayer.olLayer);
                //         // TODO add layer to anolLayers of lastAddedLayer when anolLayer refactored anolLayers
                //         return lastAddedLayer.olLayer;
                //     }
                // TODO refactor to anolLayers with list of layers
                // HINT olLayer.anolLayer is used in featurepopup-, geocoder- and geolocation-directive
                //      this will only affacts DynamicGeoJsonLayer
                olLayer.set('anolLayer', layer);
                layer.setOlLayer(olLayer);
                return olLayer;
            };
            /**
             * private function
             * Adds layer to internal lists, executes addLayer handlers and calls _addLayer
             */
            Layers.prototype._prepareLayer = function (layer) {
                var self = this;

                var layers = [layer];
                if (layer instanceof anol.layer.Group) {
                    if (angular.isDefined(layer.name)) {
                        self.nameGroupsMap[layer.name] = layer;
                    }
                    layers = layer.layers;
                }

                angular.forEach(layers, function (_layer) {
                    if (angular.isDefined(_layer.name)) {
                        self.nameLayersMap[_layer.name] = _layer;
                    }
                });

                angular.forEach(layers, function (_layer) {
                    self.createOlLayer(_layer);
                    self.addedLayers.push(_layer);
                    if (_layer.options !== undefined && _layer.options.visible) {
                        _layer.setVisible(true);
                    }
                    angular.forEach(self.addLayerHandlers, function (handler) {
                        handler(_layer);
                    });
                });

                // while map is undefined, don't add layers to it
                // when map is created, all this.layers are added to map
                // after that, this.map is registered
                // so, when map is defined, added layers are not in map
                // and must be added
                if (angular.isDefined(self.map)) {
                    if (layer instanceof anol.layer.Group) {
                        angular.forEach(layer.layers, function (_layer, idx) {
                            if (self.olLayers.indexOf(_layer.olLayer) < 0) {
                                self._addLayer(_layer, false);
                            }
                        });
                    } else {
                        if (self.olLayers.indexOf(layer.olLayer) < 0) {
                            self._addLayer(layer, false);
                        }
                    }
                }
            };
            /**
             * private function
             * Add layer to map and execute postAddToMap function of layer
             */
            Layers.prototype._addLayer = function (layer, skipLayerIndex) {
                window.map = this.map;
                this.map.addLayer(layer.olLayer);
                layer.map = this.map;

                if (skipLayerIndex !== true) {
                    this.olLayers.push(layer.olLayer);
                }
            };
            /**
             * @ngdoc method
             * @name layers
             * @methodOf anol.map.LayersService
             * @returns {array.<anol.layer.Layer>} All layers, including groups
             * @description
             * Get all layers managed by layers service
             */
            Layers.prototype.layers = function () {
                var self = this;
                return self.backgroundLayers.concat(self.overlayLayers);
            };
            /**
             * @ngdoc method
             * @name flattedLayers
             * @methodOf anol.map.LayersService
             * @returns {Array.<anol.layer.Layer>} flattedLayers
             * @description
             * Returns all layers except groups. Grouped layers extracted from their gropus.
             */
            Layers.prototype.flattedLayers = function () {
                var self = this;
                var flattedLayers = [];
                angular.forEach(self.layers(), function (layer) {
                    if (layer instanceof anol.layer.Group) {
                        flattedLayers = flattedLayers.concat(layer.layers);
                    } else {
                        flattedLayers.push(layer);
                    }
                });
                return flattedLayers;
            };
            /**
             * @ngdoc method
             * @name activeBackgroundLayer
             * @methodOf anol.map.LayersService
             * @returns {anol.layer.Layer} backgroundLayer visible background layer
             * @description
             * Returns the visible background layer
             */
            Layers.prototype.activeBackgroundLayer = function () {
                var self = this;
                var backgroundLayer;
                angular.forEach(self.backgroundLayers, function (layer) {
                    if (layer.getVisible() === true) {
                        backgroundLayer = layer;
                    }
                });
                return backgroundLayer;
            };
            /**
             * @ngdoc method
             * @name activeLayers
             * @methodOf anol.map.LayersService
             * @returns {anol.layer.Layer}
             * @description
             * Returns the visible layers
             */
            Layers.prototype.layerIsActive = function (layerName) {
                var self = this;
                var active = false;
                angular.forEach(self.flattedLayers(), function (layer) {
                    if (layer.name === layerName && layer.getVisible() === true) {
                        active = true;
                    }
                });

                return active;
            };
            /**
             * @ngdoc method
             * @name layerByName
             * @methodOf anol.map.LayersService
             * @param {string} name
             * @returns {anol.layer.Layer} layer
             * @description Gets a layer by it's name
             */
            Layers.prototype.layerByName = function (name) {
                return this.nameLayersMap[name];
            };
            /**
             * @ngdoc method
             * @name groupByName
             * @methodOf anol.map.LayersService
             * @param {string} name
             * @returns {anol.layer.Group} group
             * @description Gets a group by it's name
             */
            Layers.prototype.groupByName = function (name) {
                return this.nameGroupsMap[name];
            };

            Layers.prototype.deleteLayers = function (deletedLayers) {
                var self = this;
                if (angular.isUndefined(deletedLayers)) {
                    return;
                }
                angular.forEach(deletedLayers, function (overlayLayer) {
                    var layer = self.layerByName(overlayLayer);
                    if (angular.isUndefined(layer)) {
                        layer = self.groupByName(overlayLayer);
                    }
                    if (angular.isDefined(layer)) {
                        self.removeOverlayLayer(layer)
                    }
                });
            };

            Layers.prototype.setLayerOrder = function (layers) {
                // in this function the original arrays need to be preserved.

                let skippedLayers = 0;

                layers.forEach((layer, newIndex) => {
                    const oldIndex = this.overlayLayers.findIndex(l => angular.isDefined(l) && l.name === layer.name);
                    if (oldIndex < 0) {
                        console.warn(`Trying to change order of non existing layer ${layer.name}`);
                        skippedLayers++;
                        return;
                    }
                    const overlayLayer = this.overlayLayers[oldIndex];
                    anol.helper.array_move(this.overlayLayers, oldIndex, newIndex - skippedLayers);
                    if (overlayLayer instanceof anol.layer.Group && layer.layers !== undefined) {

                        let skippedChildLayers = 0;

                        layer.layers.forEach((childLayerName, newGroupIndex) => {
                            const oldGroupIndex = overlayLayer.layers.findIndex(l => l.name === childLayerName);
                            if (oldGroupIndex < 0) {
                                console.warn(`Trying to change order of non existing layer ${childLayerName}`);
                                skippedChildLayers++;
                                return;
                            }
                            anol.helper.array_move(overlayLayer.layers, oldGroupIndex, newGroupIndex - skippedChildLayers);
                        });
                    }
                });

                this.reorderOverlayLayers();
            };

            Layers.prototype.setCollapsedGroups = function (groupLayers) {
                this.overlayLayers.forEach(function (layer) {
                    if (layer instanceof anol.layer.Group) {
                        if (groupLayers.indexOf(layer.name) >= 0) {
                            layer.options.collapsed = false;
                        }
                    }
                });
            };

            Layers.prototype.getCollapsedGroups = function () {
                var groups = [];
                this.overlayLayers.forEach(function (layer) {
                    if (layer instanceof anol.layer.Group) {
                        if (!layer.options.collapsed) {
                            groups.push(layer.name);
                        }
                    }
                });
                return groups;
            };

            Layers.prototype.overlayLayersAsArray = function () {
                return this.overlayLayers.map(layer => {
                    let layers = [];
                    if (layer instanceof anol.layer.Group) {
                        layers = layer.layers.map(l => l.name);
                    }
                    return {
                        name: layer.name,
                        layers
                    };
                });
            };
            Layers.prototype.reorderGroupLayers = function () {
                var lastOlLayerUid = undefined;
                var self = this;
                self.zIndex = 0;
                self.overlayLayers.slice().reverse().forEach(function (layer) {
                    if (layer instanceof anol.layer.Group) {
                        layer.layers.slice().reverse().forEach(function (grouppedLayer, idx) {
                            if (lastOlLayerUid !== grouppedLayer.olLayer.ol_uid) {
                                grouppedLayer.olLayer.setZIndex(self.zIndex);
                                self.zIndex = self.zIndex + 1;
                            }
                            lastOlLayerUid = grouppedLayer.olLayer.ol_uid;
                        });
                    } else {
                        layer.olLayer.setZIndex(self.zIndex);
                        self.zIndex = self.zIndex + 1;
                    }
                });

            };
            Layers.prototype.reorderOverlayLayers = function () {
                var lastOlLayerUid = undefined;
                var self = this;
                self.zIndex = 0;
                self.overlayLayers.slice().reverse().forEach(function (layer) {
                    if (angular.isUndefined(layer)) {
                        return true;
                    }

                    if (layer instanceof anol.layer.Group) {
                        layer.layers.slice().reverse().forEach(function (grouppedLayer, idx) {
                            if (grouppedLayer.combined && grouppedLayer.reOrderLayerParams) {
                                grouppedLayer.reOrderLayerParams(layer.layers);
                            }
                            if (lastOlLayerUid !== grouppedLayer.olLayer.ol_uid) {
                                grouppedLayer.olLayer.setZIndex(self.zIndex);
                                self.zIndex = self.zIndex + 1;
                            }
                            lastOlLayerUid = grouppedLayer.olLayer.ol_uid;
                        });
                    } else {
                        layer.olLayer.setZIndex(self.zIndex);
                        self.zIndex = self.zIndex + 1;
                    }
                });
            };
            Layers.prototype.lastAddedLayer = function () {
                var idx = this.addedLayers.length - 1;
                if (idx > -1) {
                    return this.addedLayers[idx];
                }
            };
            Layers.prototype.registerRemoveLayerHandler = function (handler) {
                this.removeLayerHandlers.push(handler);
            };
            Layers.prototype.registerAddLayerHandler = function (handler) {
                this.addLayerHandlers.push(handler);
            };
            return new Layers(_layers, _addLayerHandlers, _removeLayerHandlers, _clusterDistance);
        }];
    }]);
