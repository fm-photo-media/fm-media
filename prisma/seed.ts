import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const images = [
  {
    title: "Front Exterior",
    alt: "Front exterior real estate photo of a two-story home with porch",
    category: "Exterior",
    imageUrl: "/images/portfolio/real-estate-photo-01.jpg",
    featured: true
  },
  {
    title: "Back Patio",
    alt: "Back patio and yard real estate photo with mature trees",
    category: "Exterior",
    imageUrl: "/images/portfolio/real-estate-photo-02.jpg",
    featured: false
  },
  {
    title: "Rear Exterior",
    alt: "Rear exterior real estate photo showing balcony, yard, and deck",
    category: "Exterior",
    imageUrl: "/images/portfolio/real-estate-photo-03.jpg",
    featured: true
  },
  {
    title: "Living Room",
    alt: "Living room real estate photo with sofa seating and natural light",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-04.jpg",
    featured: false
  },
  {
    title: "Dining Room",
    alt: "Dining room real estate photo with wood flooring and window light",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-05.jpg",
    featured: false
  },
  {
    title: "Bathroom",
    alt: "Bathroom real estate photo with vanity and shower curtain",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-07.jpg",
    featured: false
  },
  {
    title: "Kitchen",
    alt: "Kitchen real estate photo with white cabinets and wood floor",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-08.jpg",
    featured: false
  },
  {
    title: "Second Living Area",
    alt: "Second living room real estate photo with sofa and coffee table",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-10.jpg",
    featured: true
  },
  {
    title: "Second Bathroom",
    alt: "Bathroom real estate photo with blue wall and vanity",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-11.jpg",
    featured: false
  },
  {
    title: "Guest Bedroom",
    alt: "Guest bedroom real estate photo with bunk bed and dresser",
    category: "Interior",
    imageUrl: "/images/portfolio/real-estate-photo-12.jpg",
    featured: false
  },
  {
    title: "Deck View",
    alt: "Deck real estate photo overlooking trees and yard",
    category: "Exterior",
    imageUrl: "/images/portfolio/real-estate-photo-13.jpg",
    featured: false
  },
  {
    title: "Rear Exterior Yard",
    alt: "Rear exterior real estate photo showing a fenced backyard, deck, and mature trees",
    category: "Exterior",
    imageUrl: "/images/portfolio/rear-exterior-dsc08721.jpg",
    featured: false
  }
];

const services = [
  {
    title: "Basic",
    slug: "basic-photo-package",
    category: "PHOTO",
    priceLabel: "$100",
    bestUse: "Best for condos",
    squareFeet: "Up to 1,500 sq ft",
    summary: "A lean photo set for small listings that need clean MLS-ready coverage.",
    description: "Professionally edited listing photos for condos, apartments, and smaller homes where speed and clarity matter.",
    startingAt: 100,
    deliverable: "10-15 professionally edited photos",
    turnaround: "Fast delivery",
    featured: true
  },
  {
    title: "Standard",
    slug: "standard-photo-package",
    category: "PHOTO",
    priceLabel: "$135",
    bestUse: "Most popular",
    squareFeet: "Up to 2,500 sq ft",
    summary: "Balanced coverage for the majority of single-family listings.",
    description: "Interior and exterior coverage edited for accurate color, straight verticals, and polished listing presentation.",
    startingAt: 135,
    deliverable: "20-25 professionally edited photos",
    turnaround: "Fast delivery",
    featured: true,
    sortOrder: 1
  },
  {
    title: "Premium",
    slug: "premium-photo-package",
    category: "PHOTO",
    priceLabel: "$200",
    bestUse: "Best for larger homes",
    squareFeet: "Up to 4,000 sq ft",
    summary: "Expanded photo coverage for larger homes and higher-value listings.",
    description: "A fuller listing gallery with more room coverage, exterior angles, and details that help buyers understand the property.",
    startingAt: 200,
    deliverable: "30-40 professionally edited photos",
    turnaround: "Fast delivery",
    featured: true,
    sortOrder: 2
  },
  {
    title: "Luxury",
    slug: "luxury-photo-package",
    category: "PHOTO",
    priceLabel: "$250-$400+",
    bestUse: "Best for estates",
    squareFeet: "4,000+ sq ft",
    summary: "Custom coverage for large homes, estates, and listings with broader marketing needs.",
    description: "A larger image set planned around property size, features, acreage, and final marketing scope.",
    startingAt: 250,
    deliverable: "40-60 professionally edited photos",
    turnaround: "Custom timeline",
    featured: false,
    sortOrder: 3
  },
  {
    title: "Drone Photos",
    slug: "drone-photos",
    category: "ADD_ON",
    priceLabel: "$75",
    bestUse: "Best for lots and curb appeal",
    summary: "Aerial images that show the lot, roofline, neighborhood context, and exterior scale.",
    description: "Add drone photos when the property benefits from overhead context or stronger exterior marketing assets.",
    startingAt: 75,
    deliverable: "5-10 aerial shots",
    turnaround: "Delivered with photo package",
    sortOrder: 10
  },
  {
    title: "Drone Video",
    slug: "drone-video",
    category: "ADD_ON",
    priceLabel: "$125",
    bestUse: "Best for social reels",
    summary: "Short aerial motion for listings that need more presence online.",
    description: "A compact drone video designed for listing pages, social media, and quick property promotion.",
    startingAt: 125,
    deliverable: "30-60 second drone video",
    turnaround: "Delivered with video package",
    sortOrder: 11
  },
  {
    title: "Floor Plans",
    slug: "floor-plans",
    category: "ADD_ON",
    priceLabel: "$50",
    bestUse: "Best for layout clarity",
    summary: "A simple floor plan helps buyers understand flow before they tour.",
    description: "A clean 2D floor plan layout to pair with listing photos and reduce buyer guesswork.",
    startingAt: 50,
    deliverable: "2D layout floor plan",
    turnaround: "Delivered with photo package",
    sortOrder: 12
  },
  {
    title: "Basic Walkthrough",
    slug: "basic-walkthrough-video",
    category: "VIDEO",
    priceLabel: "$150",
    bestUse: "Best for quick tours",
    summary: "A clear walkthrough video for listings that need motion without a full cinematic edit.",
    description: "A straightforward property walkthrough that helps buyers understand room flow and overall layout.",
    startingAt: 150,
    deliverable: "1-2 minute property walkthrough video",
    turnaround: "Fast delivery",
    sortOrder: 20
  },
  {
    title: "Cinematic Video",
    slug: "cinematic-video",
    category: "VIDEO",
    priceLabel: "$250",
    bestUse: "Best for premium listings",
    summary: "A polished property video for stronger listing campaigns and brand presentation.",
    description: "A more refined video edit with cinematic movement, pacing, and detail coverage.",
    startingAt: 250,
    deliverable: "2-4 minute cinematic property video",
    turnaround: "Custom timeline",
    sortOrder: 21
  },
  {
    title: "Agent Intro Video",
    slug: "agent-intro-video",
    category: "VIDEO",
    priceLabel: "$125",
    bestUse: "Best for agent branding",
    summary: "A short intro video to help agents add a personal touch to a listing campaign.",
    description: "A concise video introducing the agent, team, or brand for social media and listing promotions.",
    startingAt: 125,
    deliverable: "Short agent or brand introduction video",
    turnaround: "Fast delivery",
    sortOrder: 22
  },
  {
    title: "Repeat Listing Discount",
    slug: "repeat-listing-discounts",
    category: "DISCOUNT",
    priceLabel: "10%-20% off",
    bestUse: "Best for active agents",
    summary: "Discounted rates are available for repeat listings and ongoing realtor work.",
    description: "10% off Standard packages, 15% off Premium packages, and up to 20% off Luxury packages depending on property size and scope.",
    startingAt: 0,
    deliverable: "Custom bundle rates for multiple listings or ongoing work",
    turnaround: "Quoted by request",
    sortOrder: 30
  }
];

async function main() {
  await prisma.service.deleteMany({
    where: {
      slug: {
        notIn: services.map((service) => service.slug)
      }
    }
  });

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: service,
      create: service
    });
  }

  await prisma.galleryImage.deleteMany({
    where: {
      imageUrl: {
        notIn: images.map((item) => item.imageUrl)
      }
    }
  });

  for (const image of images) {
    const existing = await prisma.galleryImage.findFirst({ where: { imageUrl: image.imageUrl } });
    if (!existing) {
      await prisma.galleryImage.create({ data: image });
    } else {
      await prisma.galleryImage.update({ where: { id: existing.id }, data: image });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
