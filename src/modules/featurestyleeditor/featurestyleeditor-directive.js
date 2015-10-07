angular.module('anol.featurestyleeditor')

.directive('anolFeatureStyleEditor', ['$modal', function($modal) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'src/modules/featurestyleeditor/templates/featurestyleeditor.html',
        transclude: true,
        link: function(scope, element, attrs) {
            scope.openEditor = function() {
                var modalInstance = $modal.open({
                    templateUrl: 'src/modules/featurestyleeditor/templates/featurestyleeditor-modal.html',
                    controller: 'FeatureStyleEditorModalController',
                    resolve: {
                        style: function () {
                            return scope.feature.getProperties().style || {};
                        },
                        geometryType: function() {
                            return scope.feature.getGeometry().getType();
                        }
                    }
                });
                modalInstance.result.then(function(style) {
                    if(!angular.equals(style, {})) {
                        scope.feature.set('style', style);
                    }
                    scope.feature = undefined;
                });
            };
        },
        controller: function($scope, $element, $attrs) {
            this.editFeature = function(feature) {
                $scope.feature = feature;
                $scope.openEditor();
            };
        }
    };
}])

.controller('FeatureStyleEditorModalController', function($scope, $modalInstance, style, geometryType) {
    $scope.style = style;
    $scope.geometryType = geometryType;
    $scope.strokeDashStyles = [
        'solid',
        'dot',
        'dash',
        'dashdot',
        'longdash',
        'longdashdot'
    ];

    $scope.ok = function () {
        $modalInstance.close($scope.style);
    };
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});
