import type React from "react";
import type { BlockType } from "../../../lib/blocks";
import Hero from "./hero";
import Text from "./text";
import ProductGrid from "./product-grid";
import CategoryGrid from "./category-grid";
import ImageGallery from "./image-gallery";
import CtaBanner from "./cta-banner";
import Faq from "./faq";
import ContactInfo from "./contact-info";
import Testimonials from "./testimonials";
import Newsletter from "./newsletter";
import ImageTextSplit from "./image-text-split";
import VideoEmbed from "./video-embed";
import Divider from "./divider";
import ProductGallery from "./product-gallery";
import ProductInfo from "./product-info";
import ProductLongDescription from "./product-long-description";
import ProductRelated from "./product-related";
import CatalogGridBound from "./catalog-grid-bound";
import Stats from "./stats";
import ShippingStrip from "./shipping-strip";
import FeatureList from "./feature-list";
import SocialLinks from "./social-links";

const MAP: Record<BlockType, React.ComponentType> = {
  hero: Hero,
  text: Text,
  "product-grid": ProductGrid,
  "category-grid": CategoryGrid,
  "image-gallery": ImageGallery,
  "cta-banner": CtaBanner,
  faq: Faq,
  "contact-info": ContactInfo,
  testimonials: Testimonials,
  newsletter: Newsletter,
  "image-text-split": ImageTextSplit,
  "video-embed": VideoEmbed,
  divider: Divider,
  stats: Stats,
  "shipping-strip": ShippingStrip,
  "feature-list": FeatureList,
  "social-links": SocialLinks,
  "product-gallery": ProductGallery,
  "product-info": ProductInfo,
  "product-long-description": ProductLongDescription,
  "product-related": ProductRelated,
  "catalog-grid-bound": CatalogGridBound,
};

export default function BlockIllustration({ type }: { type: BlockType }) {
  const Component = MAP[type];
  return <Component />;
}
