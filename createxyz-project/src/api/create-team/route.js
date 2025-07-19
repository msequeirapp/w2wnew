async function handler({ name, description, maxPlayers = 11, logoUrl }) {
  const session = getSession();

  if (!session?.user?.id) {
    return {
      error: "You must be logged in to create a team",
      code: "UNAUTHORIZED",
    };
  }

  if (!name || !name.trim()) {
    return {
      error: "Team name is required",
      code: "MISSING_TEAM_NAME",
    };
  }

  if (name.length > 255) {
    return {
      error: "Team name must be 255 characters or less",
      code: "NAME_TOO_LONG",
    };
  }

  if (description && description.length > 1000) {
    return {
      error: "Team description must be 1000 characters or less",
      code: "DESCRIPTION_TOO_LONG",
    };
  }

  if (maxPlayers < 1 || maxPlayers > 50) {
    return {
      error: "Max players must be between 1 and 50",
      code: "INVALID_MAX_PLAYERS",
    };
  }

  try {
    const existingTeam = await sql`
      SELECT id FROM teams 
      WHERE LOWER(name) = LOWER(${name.trim()}) AND is_active = true
    `;

    if (existingTeam.length > 0) {
      return {
        error: "A team with this name already exists",
        code: "TEAM_NAME_EXISTS",
      };
    }

    const [newTeam] = await sql`
      INSERT INTO teams (
        name, 
        description, 
        captain_id, 
        logo_url, 
        max_players,
        is_active
      )
      VALUES (
        ${name.trim()}, 
        ${description?.trim() || null}, 
        ${session.user.id}, 
        ${logoUrl || null}, 
        ${maxPlayers},
        true
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${newTeam.id}, ${session.user.id}, 'captain')
    `;

    return {
      success: true,
      message: "Team created successfully!",
      team: {
        id: newTeam.id,
        name: newTeam.name,
        description: newTeam.description,
        captainId: newTeam.captain_id,
        logoUrl: newTeam.logo_url,
        maxPlayers: newTeam.max_players,
        isActive: newTeam.is_active,
        createdAt: newTeam.created_at,
        memberCount: 1,
        role: "captain",
      },
    };
  } catch (error) {
    console.error("Error creating team:", error);
    return {
      error: "Failed to create team. Please try again.",
      code: "SERVER_ERROR",
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}