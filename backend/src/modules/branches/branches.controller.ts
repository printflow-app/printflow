import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { BranchesService, CreateBranchDto } from './branches.service';

// =============================================
// BRANCHES CONTROLLER — Multi-Filial boshqaruvi
// Bu controller `multiBranch` feature bilan himoyalanmagan —
// feature check frontend + service darajasida amalga oshiriladi.
// =============================================

@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  create(@Body() data: CreateBranchDto) {
    return this.branchesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<CreateBranchDto> & { isActive?: boolean }) {
    return this.branchesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }
}
