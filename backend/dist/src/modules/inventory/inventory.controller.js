"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
let InventoryController = class InventoryController {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    findAllMaterials() {
        return this.inventoryService.findAllMaterials();
    }
    findOneMaterial(id) {
        return this.inventoryService.findOneMaterial(id);
    }
    createMaterial(data) {
        return this.inventoryService.createMaterial(data);
    }
    updateMaterial(id, data) {
        return this.inventoryService.updateMaterial(id, data);
    }
    removeMaterial(id) {
        return this.inventoryService.removeMaterial(id);
    }
    stockIn(materialId, body) {
        return this.inventoryService.stockIn(materialId, body.quantity, body.note, body.taskId);
    }
    stockOut(materialId, body) {
        return this.inventoryService.stockOut(materialId, body.quantity, body.note, body.taskId);
    }
    writeOff(materialId, body) {
        return this.inventoryService.writeOff(materialId, body.quantity, body.note, body.taskId);
    }
    getMovements(materialId) {
        return this.inventoryService.getMovements(materialId);
    }
    deductByTask(body) {
        return this.inventoryService.deductByTask(body.taskId, body.serviceId, body.quantity, body.wasteQty);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Get)('materials'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "findAllMaterials", null);
__decorate([
    (0, common_1.Get)('materials/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "findOneMaterial", null);
__decorate([
    (0, common_1.Post)('materials'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "createMaterial", null);
__decorate([
    (0, common_1.Put)('materials/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "updateMaterial", null);
__decorate([
    (0, common_1.Delete)('materials/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "removeMaterial", null);
__decorate([
    (0, common_1.Post)('materials/:id/stock-in'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stockIn", null);
__decorate([
    (0, common_1.Post)('materials/:id/stock-out'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stockOut", null);
__decorate([
    (0, common_1.Post)('materials/:id/write-off'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "writeOff", null);
__decorate([
    (0, common_1.Get)('movements'),
    __param(0, (0, common_1.Query)('materialId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Post)('deduct-by-task'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "deductByTask", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map