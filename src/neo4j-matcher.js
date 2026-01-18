/**
 * Àpínlẹ̀rọ Neo4j Product Matcher
 *
 * Connects the WhatsApp bot to the Knowledge Graph for intelligent
 * product matching using Yoruba + English aliases.
 */

import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

// Neo4j connection
const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

let driver = null;
let isConnected = false;

// Initialize Neo4j driver
if (uri && user && password) {
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    console.log('✅ Neo4j driver initialized for product matching');
    isConnected = true;
  } catch (error) {
    console.warn('⚠️ Neo4j not configured - using fallback matching');
  }
} else {
  console.warn('⚠️ Neo4j credentials not found - using fallback matching');
}

/**
 * Match a product term using the Knowledge Graph
 * Falls back to local matching if Neo4j is unavailable
 *
 * @param {string} searchTerm - The term to match (e.g., 'epo pupa', 'red oil')
 * @returns {Promise<Object|null>} - Matched product info or null
 */
export async function matchProductFromGraph(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return null;
  }

  const normalizedTerm = searchTerm.toLowerCase().trim();

  // If Neo4j not available, return null (caller should use fallback)
  if (!driver || !isConnected) {
    return null;
  }

  const session = driver.session();

  try {
    // Try exact alias match first
    const exactResult = await session.run(`
      MATCH (a:Alias)-[:REFERS_TO]->(p:Product)
      WHERE a.name = $term
      RETURN p.name as productName,
             p.price as price,
             p.category as category,
             a.name as matchedAlias,
             a.language as language,
             1.0 as confidence
      LIMIT 1
    `, { term: normalizedTerm });

    if (exactResult.records.length > 0) {
      const record = exactResult.records[0];
      return {
        product: record.get('productName'),
        price: record.get('price'),
        category: record.get('category'),
        alias: record.get('matchedAlias'),
        language: record.get('language'),
        confidence: 1.0,
        source: 'neo4j_exact'
      };
    }

    // Try partial match
    const partialResult = await session.run(`
      MATCH (a:Alias)-[:REFERS_TO]->(p:Product)
      WHERE a.name CONTAINS $term OR $term CONTAINS a.name
      RETURN p.name as productName,
             p.price as price,
             p.category as category,
             a.name as matchedAlias,
             a.language as language,
             0.8 as confidence
      LIMIT 1
    `, { term: normalizedTerm });

    if (partialResult.records.length > 0) {
      const record = partialResult.records[0];
      return {
        product: record.get('productName'),
        price: record.get('price'),
        category: record.get('category'),
        alias: record.get('matchedAlias'),
        language: record.get('language'),
        confidence: 0.8,
        source: 'neo4j_partial'
      };
    }

    // Try direct product name match
    const productResult = await session.run(`
      MATCH (p:Product)
      WHERE toLower(p.name) CONTAINS $term OR $term CONTAINS toLower(p.name)
      RETURN p.name as productName,
             p.price as price,
             p.category as category,
             0.9 as confidence
      LIMIT 1
    `, { term: normalizedTerm });

    if (productResult.records.length > 0) {
      const record = productResult.records[0];
      return {
        product: record.get('productName'),
        price: record.get('price'),
        category: record.get('category'),
        alias: null,
        language: 'english',
        confidence: 0.9,
        source: 'neo4j_product'
      };
    }

    return null;
  } catch (error) {
    console.error('Neo4j matching error:', error.message);
    return null;
  } finally {
    await session.close();
  }
}

/**
 * Get all product aliases from the Knowledge Graph
 * Used to update the local fallback cache
 *
 * @returns {Promise<Object>} - Map of product names to aliases
 */
export async function getAllAliases() {
  if (!driver || !isConnected) {
    return null;
  }

  const session = driver.session();

  try {
    const result = await session.run(`
      MATCH (a:Alias)-[:REFERS_TO]->(p:Product)
      RETURN p.name as product, collect(a.name) as aliases
    `);

    const aliasMap = {};
    for (const record of result.records) {
      const product = record.get('product');
      const aliases = record.get('aliases');
      aliasMap[product] = aliases;
    }

    return aliasMap;
  } catch (error) {
    console.error('Failed to fetch aliases:', error.message);
    return null;
  } finally {
    await session.close();
  }
}

/**
 * Check if Neo4j is available
 * @returns {boolean}
 */
export function isNeo4jAvailable() {
  return isConnected && driver !== null;
}

/**
 * Close the Neo4j driver (for cleanup)
 */
export async function closeNeo4j() {
  if (driver) {
    await driver.close();
    isConnected = false;
  }
}

export default {
  matchProductFromGraph,
  getAllAliases,
  isNeo4jAvailable,
  closeNeo4j
};
