def get_user_distributor(user):
    if not user or not user.is_authenticated:
        return None
    if user.role == "DISTRIBUTOR":
        return user.owned_distributors.first()
    if user.role == "DRIVER" and hasattr(user, "driver_profile"):
        return user.driver_profile.distributor
    if user.role == "COMMERCE" and hasattr(user, "commerce_profile"):
        return user.commerce_profile.distributor
    return None


def filter_by_distributor(queryset, user, field_name="distributor"):
    if user.role == "ADMIN" or user.is_superuser:
        return queryset
    distributor = get_user_distributor(user)
    if distributor is None:
        return queryset.none()
    return queryset.filter(**{field_name: distributor})
