import { Body, Controller, Delete, Get, Param, Patch, Post as HttpPost, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import { CreateConversationInput } from './dto/create-conversation.input';
import { UpdateConversationInput } from './dto/update-conversation.input';
import { Conversation } from './entities/conversation.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('conversations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations' })
  @ApiResponse({ status: 200, type: [Conversation] })
  findAll() {
    return this.conversationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by id' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: Conversation })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.conversationService.findOne(id);
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a conversation' })
  @ApiBody({ type: CreateConversationInput })
  @ApiResponse({ status: 201, type: Conversation })
  create(@Body() body: CreateConversationInput) {
    return this.conversationService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateConversationInput })
  @ApiResponse({ status: 200, type: Conversation })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Omit<UpdateConversationInput, 'id'>,
  ) {
    return this.conversationService.update(id, { ...(body as UpdateConversationInput), id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: Conversation })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.conversationService.remove(id);
  }
}

