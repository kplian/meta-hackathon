create or replace function budget.f_validate_user(
  p_channel_code text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user record;
  v_household record;
  v_response json;
  v_number_household integer = 0;
begin

  -- Buscar el usuario por su channel id
  select u.id, u.full_name, u.status
  into v_user
  from budget.tuser u
  join budget.tchannel ch
  on ch.user_id = u.id
  where ch.channel_code = p_channel_code
    and u.status = 'active'
  limit 1;

  -- Si no se encuentra el usuario
  if v_user.id is null then
    return json_build_object(
      'registered', false,
      'message', 'The user identificator is not registered in the system.'
    );
  end if;

  -- Verifica si tiene household
  select count(1)
  into v_number_household
  from budget.thousehold_member
  where user_id = v_user.id;

  if COALESCE(v_number_household, 0) = 1 then
    select ho.id, ho.name, ho.currency, u.locale
    into v_household
    from budget.thousehold_member hm
    join budget.thousehold ho
    on ho.id = hm.household_id
    join budget.tuser u
    on u.id = hm.user_id
    where hm.user_id = v_user.id;
  end if;

  -- Si el usuario existe y está activo
  if COALESCE(v_number_household, 0) = 1 then
    v_response = json_build_object(
      'registered', true,
      'userId', v_user.id,
      'fullName', v_user.full_name,
      'message', 'User successfully verified',
      'countHousehold', v_number_household,
      'household', json_build_object(
        'id', v_household.id,
        'name', v_household.name,
        'locale', v_household.locale,
        'currency', v_household.currency
      )
    );
  else

    v_response = json_build_object(
      'registered', true,
      'userId', v_user.id,
      'fullName', v_user.full_name,
      'message', 'User successfully verified',
      'countHousehold', v_number_household
    );

  end if;
  
  
  return v_response;

end;
$$;