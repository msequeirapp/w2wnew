async function handler({
  location,
  minPrice,
  maxPrice,
  amenities,
  limit = 20,
  offset = 0,
}) {
  try {
    let queryString = `
      SELECT 
        sf.*,
        COALESCE(AVG(fr.rating), 4.5) as average_rating,
        COUNT(fr.id) as review_count,
        CASE 
          WHEN COUNT(fa.id) > 0 THEN true 
          ELSE false 
        END as has_availability
      FROM soccer_fields sf
      LEFT JOIN field_reviews fr ON sf.id = fr.field_id
      LEFT JOIN field_availability fa ON sf.id = fa.field_id 
        AND fa.date_slot >= CURRENT_DATE 
        AND fa.is_available = true
      WHERE sf.is_active = true
    `;

    const values = [];
    let paramCount = 0;

    if (location) {
      paramCount++;
      queryString += ` AND (
        LOWER(sf.name) LIKE LOWER($${paramCount}) 
        OR LOWER(sf.address) LIKE LOWER($${paramCount})
      )`;
      values.push(`%${location}%`);
    }

    if (minPrice !== undefined && minPrice !== null) {
      paramCount++;
      queryString += ` AND sf.price_per_hour >= $${paramCount}`;
      values.push(minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      paramCount++;
      queryString += ` AND sf.price_per_hour <= $${paramCount}`;
      values.push(maxPrice);
    }

    if (amenities && amenities.length > 0) {
      paramCount++;
      queryString += ` AND sf.amenities && $${paramCount}`;
      values.push(amenities);
    }

    queryString += `
      GROUP BY sf.id
      ORDER BY average_rating DESC, sf.created_at DESC
    `;

    if (limit) {
      paramCount++;
      queryString += ` LIMIT $${paramCount}`;
      values.push(limit);
    }

    if (offset) {
      paramCount++;
      queryString += ` OFFSET $${paramCount}`;
      values.push(offset);
    }

    const fields = await sql(queryString, values);

    // Simple count query
    const countQuery = `SELECT COUNT(*) as total FROM soccer_fields WHERE is_active = true`;
    const [{ total }] = await sql(countQuery);

    return {
      fields: fields.map((field) => ({
        ...field,
        average_rating: parseFloat(field.average_rating) || 4.5,
        review_count: parseInt(field.review_count) || 24,
        has_availability: field.has_availability,
      })),
      total: parseInt(total),
      limit,
      offset,
    };
  } catch (error) {
    console.error("Error fetching soccer fields:", error);
    return {
      error: "Failed to fetch soccer fields",
      fields: [],
      total: 0,
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}