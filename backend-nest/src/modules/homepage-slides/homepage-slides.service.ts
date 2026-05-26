import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateHomepageSlideDto } from './dto/create-homepage-slide.dto';
import { UpdateHomepageSlideDto } from './dto/update-homepage-slide.dto';
import { ReorderHomepageSlidesDto } from './dto/reorder-homepage-slides.dto';

@Injectable()
export class HomepageSlidesService {
  constructor(private readonly prisma: PrismaService) {}

  private validatePublishWindow(startsAt?: string, endsAt?: string) {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      throw new BadRequestException('HOMEPAGE_SLIDE_INVALID_PUBLISH_WINDOW');
    }
  }

  async create(dto: CreateHomepageSlideDto) {
    this.validatePublishWindow(dto.startsAt, dto.endsAt);

    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined || displayOrder === null) {
      const maxSlide = await this.prisma.homepageSlide.findFirst({
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      displayOrder = maxSlide ? maxSlide.displayOrder + 1 : 0;
    }

    return this.prisma.homepageSlide.create({
      data: {
        titleRu: dto.titleRu,
        titleEn: dto.titleEn,
        subtitleRu: dto.subtitleRu,
        subtitleEn: dto.subtitleEn,
        ctaLabelRu: dto.ctaLabelRu,
        ctaLabelEn: dto.ctaLabelEn,
        ctaUrl: dto.ctaUrl,
        altTextRu: dto.altTextRu,
        altTextEn: dto.altTextEn,
        imageDesktopUrl: dto.imageDesktopUrl,
        imageDesktopStorageKey: dto.imageDesktopStorageKey,
        imageMobileUrl: dto.imageMobileUrl,
        imageMobileStorageKey: dto.imageMobileStorageKey,
        backgroundColor: dto.backgroundColor,
        displayOrder,
        isActive: dto.isActive ?? false,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async findAllAdmin() {
    return this.prisma.homepageSlide.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const slide = await this.prisma.homepageSlide.findUnique({
      where: { id },
    });
    if (!slide) {
      throw new NotFoundException('HOMEPAGE_SLIDE_NOT_FOUND');
    }
    return slide;
  }

  async update(id: string, dto: UpdateHomepageSlideDto) {
    const slide = await this.findOne(id);

    const startsAt =
      dto.startsAt !== undefined ? dto.startsAt : slide.startsAt?.toISOString();
    const endsAt =
      dto.endsAt !== undefined ? dto.endsAt : slide.endsAt?.toISOString();
    this.validatePublishWindow(startsAt, endsAt);

    return this.prisma.homepageSlide.update({
      where: { id },
      data: {
        titleRu: dto.titleRu !== undefined ? dto.titleRu : slide.titleRu,
        titleEn: dto.titleEn !== undefined ? dto.titleEn : slide.titleEn,
        subtitleRu:
          dto.subtitleRu !== undefined ? dto.subtitleRu : slide.subtitleRu,
        subtitleEn:
          dto.subtitleEn !== undefined ? dto.subtitleEn : slide.subtitleEn,
        ctaLabelRu:
          dto.ctaLabelRu !== undefined ? dto.ctaLabelRu : slide.ctaLabelRu,
        ctaLabelEn:
          dto.ctaLabelEn !== undefined ? dto.ctaLabelEn : slide.ctaLabelEn,
        ctaUrl: dto.ctaUrl !== undefined ? dto.ctaUrl : slide.ctaUrl,
        altTextRu:
          dto.altTextRu !== undefined ? dto.altTextRu : slide.altTextRu,
        altTextEn:
          dto.altTextEn !== undefined ? dto.altTextEn : slide.altTextEn,
        imageDesktopUrl:
          dto.imageDesktopUrl !== undefined
            ? dto.imageDesktopUrl
            : slide.imageDesktopUrl,
        imageDesktopStorageKey:
          dto.imageDesktopStorageKey !== undefined
            ? dto.imageDesktopStorageKey
            : slide.imageDesktopStorageKey,
        imageMobileUrl:
          dto.imageMobileUrl !== undefined
            ? dto.imageMobileUrl
            : slide.imageMobileUrl,
        imageMobileStorageKey:
          dto.imageMobileStorageKey !== undefined
            ? dto.imageMobileStorageKey
            : slide.imageMobileStorageKey,
        backgroundColor:
          dto.backgroundColor !== undefined
            ? dto.backgroundColor
            : slide.backgroundColor,
        displayOrder:
          dto.displayOrder !== undefined
            ? dto.displayOrder
            : slide.displayOrder,
        isActive: dto.isActive !== undefined ? dto.isActive : slide.isActive,
        startsAt:
          dto.startsAt !== undefined
            ? dto.startsAt
              ? new Date(dto.startsAt)
              : null
            : slide.startsAt,
        endsAt:
          dto.endsAt !== undefined
            ? dto.endsAt
              ? new Date(dto.endsAt)
              : null
            : slide.endsAt,
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.homepageSlide.delete({
      where: { id },
    });
  }

  async toggleActive(id: string) {
    const slide = await this.findOne(id);
    return this.prisma.homepageSlide.update({
      where: { id },
      data: { isActive: !slide.isActive },
    });
  }

  async reorder(dto: ReorderHomepageSlidesDto) {
    // Perform bulk updates sequentially or via transaction
    await this.prisma.$transaction(
      dto.slideIds.map((slideId, index) =>
        this.prisma.homepageSlide.update({
          where: { id: slideId },
          data: { displayOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  async findAllPublic() {
    const now = new Date();
    return this.prisma.homepageSlide.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        titleRu: true,
        titleEn: true,
        subtitleRu: true,
        subtitleEn: true,
        ctaLabelRu: true,
        ctaLabelEn: true,
        ctaUrl: true,
        altTextRu: true,
        altTextEn: true,
        imageDesktopUrl: true,
        imageMobileUrl: true,
        backgroundColor: true,
        displayOrder: true,
      },
    });
  }
}
