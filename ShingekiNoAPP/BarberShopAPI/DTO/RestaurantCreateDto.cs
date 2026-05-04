namespace DTO
{
    public class RestaurantCreateDto : BranchCreateDto
    {
        public string AdminUsername { get; set; }
        public string AdminPassword { get; set; }
        public string AdminName { get; set; }
        public string AdminLastName { get; set; }
        public string AdminPhone { get; set; }
    }
}
