/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('InventorySearchCtrl', InventorySearchController)
        .controller('InventoryDetailsCtrl', ProductDetailController);

    function InventorySearchController($state, $rootScope, EVENTS, InventoryProduct, INVENTORY_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        InventoryProduct.search($state.params).then(function (productList) {
            vm.list.status = LOADED;
            angular.copy(productList, vm.list);
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of products');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, INVENTORY_STATUS);
        }
    }

    function ProductDetailController(
        $rootScope, $scope, $state, InventoryProduct, Utils, ProductSpec, EVENTS, $interval, $window) {
        /* jshint validthis: true */
        var vm = this;
        var load = false;

        vm.item = {};
        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.characteristicValueSelected = characteristicValueSelected;
        vm.isRenewable = isRenewable;
        vm.renewProduct = renewProduct;
        vm.loading = loading;

        InventoryProduct.detail($state.params.productId).then(function (productRetrieved) {
            vm.item = productRetrieved;
            vm.item.status = LOADED;
            $scope.priceplanSelected = productRetrieved.productPrice[0];
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load product details');
            vm.item.status = ERROR;
        });

        function loading() {
            return load;
        }

        function isRenewable() {
            return 'productPrice' in vm.item && vm.item.productPrice.length && 'priceType' in vm.item.productPrice[0] &&
                (vm.item.productPrice[0].priceType.toLowerCase() == 'recurring'
                || vm.item.productPrice[0].priceType.toLowerCase() == 'usage')
        }

        function renewProduct() {
            load = true;
            InventoryProduct.renew({
                name: vm.item.name,
                id: vm.item.id,
                priceType: vm.item.productPrice[0].priceType.toLowerCase()
            }).then(function(reviewJob) {
                load = false;
                if ('x-redirect-url' in reviewJob.headers) {
                    var ppalWindow = $window.open(reviewJob.headers['x-redirect-url'], '_blank');
                    var interval;

                    // The function to be called when the payment process has ended
                    var paymentFinished = function(closeModal) {

                        if (interval) {
                            $interval.cancel(interval);
                        }

                        if (closeModal) {
                            $rootScope.$emit(EVENTS.MESSAGE_CLOSED);
                        }

                    };

                    // Display a message and wait until the new tab has been closed to redirect the page
                    $rootScope.$emit(EVENTS.MESSAGE_CREATED, reviewJob.headers['x-redirect-url'], paymentFinished.bind(this, false));

                    if (ppalWindow) {
                        interval = $interval(function () {
                            if (ppalWindow.closed) {
                                paymentFinished(true);
                            }
                        }, 500);
                    }
                }
            }, function (response) {
                load = false;
                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from renewing your product';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }

        function characteristicValueSelected(characteristic, characteristicValue) {
            var result, productCharacteristic, i;

            for (i = 0; i < vm.item.productCharacteristic.length; i++) {
                if (vm.item.productCharacteristic[i].name === characteristic.name) {
                    productCharacteristic = vm.item.productCharacteristic[i];
                }
            }

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING.toLowerCase():
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER.toLowerCase():
                if (characteristicValue.value && characteristicValue.value.length) {
                    result = characteristicValue.value;
                } else {
                    result = characteristicValue.valueFrom + "-" + characteristicValue.valueTo;
                }
                break;
            }

            return result === productCharacteristic.value;
        }

        function formatCharacteristicValue(characteristic, characteristicValue) {
            var result;

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING.toLowerCase():
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER.toLowerCase():
                if (characteristicValue.value && characteristicValue.value.length) {
                    result = characteristicValue.value;
                } else {
                    result = characteristicValue.valueFrom + " - " + characteristicValue.valueTo;
                }
                result += " " + characteristicValue.unitOfMeasure;
                break;
            }

            return result;
        }
    }

})();
