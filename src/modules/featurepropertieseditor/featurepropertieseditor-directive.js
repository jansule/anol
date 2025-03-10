import './module.js';
import {DigitizeState} from "../savemanager/digitize-state";

import templateHTML from './templates/featurepropertieseditor.html';

angular.module('anol.featurepropertieseditor')
    /**
     * @ngdoc directive
     * @name anol.featurepropertieseditor.directive:anolFeaturePropertiesEditor
     *
     * @restrict A
     *
     * @param {string} templateUrl Url to template to use instead of default one
     * @param {ol.Feature} anolFeaturePropertiesEditor Feature to edit
     * @param {anol.layer.Feature} layer Layer of feature
     *
     * @description
     * Shows a form for editing feature properties
     */
    .directive('anolFeaturePropertiesEditor', ['$templateRequest', '$compile',
        function ($templateRequest, $compile) {
            return {
                restrict: 'A',
                scope: {
                    feature: '=anolFeaturePropertiesEditor',
                    layer: '='
                },
                template: function (tElement, tAttrs) {
                    if (tAttrs.templateUrl) {
                        return '<div></div>';
                    }
                    return templateHTML;
                },
                link: function (scope, element, attrs) {
                    if (attrs.templateUrl && attrs.templateUrl !== '') {
                        $templateRequest(attrs.templateUrl).then(function (html) {
                            const template = angular.element(html);
                            element.html(template);
                            $compile(template)(scope);
                        });
                    }
                    scope.properties = {};
                    let propertyWatchers = {};

                    // TODO move into anol.layer.Feature
                    const ignoreProperty = function (key) {
                        return key === 'geometry' || key === 'style' || key === '_digitizeState';
                    };

                    const registerPropertyWatcher = function (key) {
                        if (ignoreProperty(key) || angular.isDefined(propertyWatchers[key])) {
                            return;
                        }
                        propertyWatchers[key] = scope.$watch(function () {
                            return scope.properties[key];
                        }, function (n) {
                            let changed = false;
                            if (angular.isUndefined(n)) {
                                scope.feature.unset(key);
                                changed = true;
                            } else if (n !== scope.feature.get(key)) {
                                scope.feature.set(key, n);
                                changed = true;
                            }
                            if (changed && scope.feature.get('_digitizeState') !== DigitizeState.NEW) {
                                scope.feature.set('_digitizeState', DigitizeState.CHANGED);
                            }
                        });
                    };

                    const clearPropertyWatchers = function () {
                        angular.forEach(propertyWatchers, function (dewatch) {
                            dewatch();
                        });
                        propertyWatchers = {};
                    };

                    scope.propertiesNames = function () {
                        const result = [];
                        angular.forEach(scope.properties, function (value, key) {
                            if (ignoreProperty(key)) {
                                return;
                            }
                            result.push(key);
                        });
                        return result;
                    };

                    scope.handleAddPropertyKeydown = function (event) {
                        if (event.key === 'Enter' || event.keyCode === 13) {
                            scope.addProperty();
                        }
                    };

                    scope.addProperty = function () {
                        if (scope.newKey) {
                            scope.properties[scope.newKey] = '';
                            scope.feature.set(scope.newKey, '');
                            if (scope.feature.get('_digitizeState') !== DigitizeState.NEW) {
                                scope.feature.set('_digitizeState', DigitizeState.CHANGED);
                            }
                            scope.newKey = '';
                        }
                    };
                    scope.removeProperty = function (key) {
                        delete scope.properties[key];
                        scope.feature.unset(key);
                        if (scope.feature.get('_digitizeState') !== DigitizeState.NEW) {
                            scope.feature.set('_digitizeState', DigitizeState.CHANGED);
                        }
                    };

                    scope.$watch('feature', function (feature) {
                        clearPropertyWatchers();
                        scope.properties = {};
                        if (angular.isDefined(feature)) {
                            scope.properties = feature.getProperties();
                        }
                    });
                    scope.$watchCollection('properties', function (properties) {
                        angular.forEach(properties, function (value, key) {
                            registerPropertyWatcher(key);
                        });
                    });
                }
            };
        }]);
