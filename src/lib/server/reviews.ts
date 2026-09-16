import { promises as fs } from "fs";
import path from "path";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { testimonials } from "@/lib/data/testimonials";
import type { ReviewSubmissionInput } from "@/lib/validation/review";

export interface PublicReview {
  id: string;
  authorName: string;
  location: string | null;
  quote: string;
  rating: number;
  isFeatured: boolean;
}

export interface AdminReview extends PublicReview {
  isPublished: boolean;
  source: string;
  createdAt: string;
}

const MOCK_DATA_DIR = path.join(process.cwd(), ".data");
const MOCK_REVIEWS_FILE = path.join(MOCK_DATA_DIR, "reviews.json");

type MockReview = AdminReview;

async function readMockReviews(): Promise<MockReview[]> {
  try {
    const raw = await fs.readFile(MOCK_REVIEWS_FILE, "utf-8");
    return JSON.parse(raw) as MockReview[];
  } catch {
    // Seed from the genuine carried-over testimonials so the mock path has
    // real content too, not an empty list.
    return testimonials.map((t) => ({
      id: t.id,
      authorName: t.name,
      location: t.location,
      quote: t.quote,
      rating: 5,
      isFeatured: true,
      isPublished: true,
      source: "direct",
      createdAt: new Date().toISOString(),
    }));
  }
}

async function writeMockReviews(reviews: MockReview[]) {
  await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  await fs.writeFile(MOCK_REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
}

/** Public, published reviews — featured ones first, for display on the site. */
export async function listPublishedReviews(): Promise<PublicReview[]> {
  if (isDatabaseConfigured && prisma) {
    const reviews = await prisma.review.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    });
    return reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      location: r.location,
      quote: r.quote,
      rating: r.rating,
      isFeatured: r.isFeatured,
    }));
  }

  const all = await readMockReviews();
  return all
    .filter((r) => r.isPublished)
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
    .map(({ id, authorName, location, quote, rating, isFeatured }) => ({ id, authorName, location, quote, rating, isFeatured }));
}

export async function submitReview(input: ReviewSubmissionInput): Promise<{ id: string }> {
  if (isDatabaseConfigured && prisma) {
    const review = await prisma.review.create({
      data: {
        authorName: input.authorName,
        location: input.location || null,
        quote: input.quote,
        rating: input.rating,
        source: "direct",
        isPublished: false,
        isFeatured: false,
      },
    });
    return { id: review.id };
  }

  const reviews = await readMockReviews();
  const id = `mock-${Date.now()}`;
  reviews.unshift({
    id,
    authorName: input.authorName,
    location: input.location || null,
    quote: input.quote,
    rating: input.rating,
    isFeatured: false,
    isPublished: false,
    source: "direct",
    createdAt: new Date().toISOString(),
  });
  await writeMockReviews(reviews);
  return { id };
}

/** Every review (published or not) for admin moderation. */
export async function listAllReviewsForAdmin(): Promise<AdminReview[]> {
  if (isDatabaseConfigured && prisma) {
    const reviews = await prisma.review.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      location: r.location,
      quote: r.quote,
      rating: r.rating,
      isFeatured: r.isFeatured,
      isPublished: r.isPublished,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  const reviews = await readMockReviews();
  return reviews.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function setReviewModeration(id: string, data: { isPublished?: boolean; isFeatured?: boolean }) {
  if (isDatabaseConfigured && prisma) {
    await prisma.review.update({ where: { id }, data });
    return;
  }

  const reviews = await readMockReviews();
  const idx = reviews.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reviews[idx] = { ...reviews[idx], ...data };
  await writeMockReviews(reviews);
}
