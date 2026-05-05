using System;
using System.Collections.Generic;

namespace DTO
{
    public class DriverLocationBatchUpdateDto : DriverLocationUpdateDto
    {
        public List<Guid> TrackingNumbers { get; set; } = new();
    }
}
