async function handler({
  fieldId,
  reservationDate,
  startTime,
  endTime,
  gameId = null,
}) {
  const session = getSession();

  if (!session?.user?.id) {
    return {
      error: "You must be logged in to make a reservation",
      code: "UNAUTHORIZED",
    };
  }

  if (!fieldId || !reservationDate || !startTime || !endTime) {
    return {
      error: "Field ID, date, start time, and end time are required",
      code: "MISSING_REQUIRED_FIELDS",
    };
  }

  try {
    const [field] = await sql`
      SELECT id, name, price_per_hour, is_active, owner_id 
      FROM soccer_fields 
      WHERE id = ${fieldId} AND is_active = true
    `;

    if (!field) {
      return {
        error: "Soccer field not found or inactive",
        code: "FIELD_NOT_FOUND",
      };
    }

    const reservationDateTime = new Date(`${reservationDate}T${startTime}`);
    const endDateTime = new Date(`${reservationDate}T${endTime}`);
    const now = new Date();

    if (reservationDateTime <= now) {
      return {
        error: "Reservation date and time must be in the future",
        code: "INVALID_DATE",
      };
    }

    if (endDateTime <= reservationDateTime) {
      return {
        error: "End time must be after start time",
        code: "INVALID_TIME_RANGE",
      };
    }

    const timeDiffHours =
      (endDateTime - reservationDateTime) / (1000 * 60 * 60);
    if (timeDiffHours > 8) {
      return {
        error: "Reservation cannot exceed 8 hours",
        code: "DURATION_TOO_LONG",
      };
    }

    if (timeDiffHours < 0.5) {
      return {
        error: "Minimum reservation time is 30 minutes",
        code: "DURATION_TOO_SHORT",
      };
    }

    const conflictingReservations = await sql`
      SELECT id FROM reservations 
      WHERE field_id = ${fieldId} 
        AND reservation_date = ${reservationDate}
        AND payment_status IN ('paid', 'pending')
        AND (
          (start_time <= ${startTime} AND end_time > ${startTime}) OR
          (start_time < ${endTime} AND end_time >= ${endTime}) OR
          (start_time >= ${startTime} AND end_time <= ${endTime})
        )
    `;

    if (conflictingReservations.length > 0) {
      return {
        error: "This time slot is already reserved",
        code: "TIME_CONFLICT",
      };
    }

    const conflictingGames = await sql`
      SELECT id FROM games 
      WHERE field_id = ${fieldId} 
        AND game_date = ${reservationDate}
        AND status IN ('open', 'full')
        AND (
          (start_time <= ${startTime} AND end_time > ${startTime}) OR
          (start_time < ${endTime} AND end_time >= ${endTime}) OR
          (start_time >= ${startTime} AND end_time <= ${endTime})
        )
    `;

    if (conflictingGames.length > 0) {
      return {
        error: "There is already a game scheduled during this time",
        code: "GAME_CONFLICT",
      };
    }

    const totalAmount = field.price_per_hour * timeDiffHours;

    if (totalAmount <= 0) {
      return {
        error: "Invalid reservation amount",
        code: "INVALID_AMOUNT",
      };
    }

    const [user] = await sql`
      SELECT stripe_id FROM auth_users 
      WHERE id = ${session.user.id}
    `;

    let stripeCustomerId = user?.stripe_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name,
      });
      stripeCustomerId = customer.id;

      await sql`
        UPDATE auth_users 
        SET stripe_id = ${stripeCustomerId}
        WHERE id = ${session.user.id}
      `;
    }

    const [newReservation] = await sql`
      INSERT INTO reservations (
        field_id, 
        user_id, 
        game_id,
        reservation_date, 
        start_time, 
        end_time, 
        total_amount,
        payment_status
      )
      VALUES (
        ${fieldId}, 
        ${session.user.id}, 
        ${gameId},
        ${reservationDate}, 
        ${startTime}, 
        ${endTime}, 
        ${totalAmount},
        'pending'
      )
      RETURNING *
    `;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100),
      currency: "crc",
      customer: stripeCustomerId,
      metadata: {
        reservationId: newReservation.id.toString(),
        fieldId: fieldId.toString(),
        userId: session.user.id.toString(),
        reservationDate: reservationDate,
        startTime: startTime,
        endTime: endTime,
      },
      description: `Field reservation at ${field.name} on ${reservationDate} from ${startTime} to ${endTime}`,
    });

    await sql`
      UPDATE reservations 
      SET stripe_payment_intent_id = ${paymentIntent.id}
      WHERE id = ${newReservation.id}
    `;

    return {
      success: true,
      message: "Reservation created successfully!",
      reservation: {
        id: newReservation.id,
        fieldId: newReservation.field_id,
        fieldName: field.name,
        userId: newReservation.user_id,
        gameId: newReservation.game_id,
        reservationDate: newReservation.reservation_date,
        startTime: newReservation.start_time,
        endTime: newReservation.end_time,
        totalAmount: parseFloat(newReservation.total_amount),
        paymentStatus: newReservation.payment_status,
        createdAt: newReservation.created_at,
      },
      payment: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        currency: "crc",
      },
    };
  } catch (error) {
    console.error("Error creating field reservation:", error);
    return {
      error: "Failed to create reservation. Please try again.",
      code: "SERVER_ERROR",
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}