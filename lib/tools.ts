
import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, getProductById, getProductStock, createReturn, getCategories, getOrder, getProducts, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";
/**
 * This is where the tools for your agent will live.
 *
 * During the workshop you'll define tools in this file that your agents
 * will choose to run depending on the question or request that is made
 * to them.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/tools
 */
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";
export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this for broad lookups: when the user asks what the store sells, wants recommendations, or wants to browse products. Optionally narrow results to a single category. For questions about one specific item, use getProductDetails instead (call this first only if you need to find the item's id or slug).`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
     .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,

      ),
  }),

  execute: async ({ query, category }) => {
     "use step";
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
     "use step";
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
  });

export const getProductDetails = tool({
  description: `Get the full details of ONE specific product: description, price, all images, category, tags, and live stock levels. Use this whenever the user asks about a specific item (e.g. "Tell me more about the black hoodie"). For broad lookups or recommendations use searchProducts instead. If you don't know the product's id or slug, call searchProducts first to find it.`,
  inputSchema: z.object({
    productId: z
      .string()
      .describe(
        `The product id or slug, taken from a searchProducts result.`,
      ),
  }),
  execute: async ({ productId }) => {
     "use step";
    try {
      const [product, stock] = await Promise.all([
        getProductById(productId),
        getProductStock(productId),
      ]);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: product.category,
        tags: product.tags,
        featured: product.featured,
        images: product.images,
        stock: stock.stock,
        inStock: stock.inStock,
        lowStock: stock.lowStock,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
     "use step";
     const run = await start(returnFlow, [orderId, reason]);
    return { runId: run.runId, message: `Return request received for order ${orderId}.` };
  },
});
