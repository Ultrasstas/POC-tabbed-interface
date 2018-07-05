import React from 'react';
import { Segment, Header, Button } from 'semantic-ui-react';

import './VerticalSegmentList.scss';

export default function VerticalSegmentList(props) {
  const { data, type, labelField } = props;

  return (
    <div>
      <Header as="h4">Click on item to get details:</Header>
      {
        data.map(item => (
          <Segment className="segment" vertical key={item.id}>
            <Button
              fluid
              compact
              onClick={() => props.onClickItem(type, item.id)}
            >{ item[labelField] }
            </Button>
          </Segment>
        ))
      }
    </div>
  );
}
